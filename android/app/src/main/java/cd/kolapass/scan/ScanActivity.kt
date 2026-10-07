package cd.kolapass.scan

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.text.InputFilter
import android.text.InputType
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.mlkit.vision.MlKitAnalyzer
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class ScanActivity : AppCompatActivity() {
    private lateinit var store: Store
    private lateinit var api: Api

    private lateinit var preview: PreviewView
    private lateinit var eventSpinner: Spinner
    private lateinit var gateSpinner: Spinner
    private lateinit var status: TextView
    private lateinit var resultPanel: View
    private lateinit var resultTitle: TextView
    private lateinit var resultName: TextView
    private lateinit var resultDetail: TextView
    private lateinit var torch: Button

    private var controller: LifecycleCameraController? = null
    private var scanner: BarcodeScanner? = null
    private var torchOn = false

    private var online = true
    private var processing = false
    private var lastValue = ""
    private var lastValueAt = 0L
    private val syncLock = Mutex()

    private var eventIds = listOf<String>()
    private var gates = listOf<String>()
    private var buildingSpinners = false

    private val handler = Handler(Looper.getMainLooper())
    private val hideResult = Runnable { resultPanel.visibility = View.GONE }
    private var tone: ToneGenerator? = null

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera()
        else findViewById<TextView>(R.id.hint).text = "Caméra refusée : autorisez-la dans les paramètres, ou utilisez « Saisir un code »."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scan)
        store = Store(this)
        api = Api(store)

        preview = findViewById(R.id.preview)
        eventSpinner = findViewById(R.id.eventSpinner)
        gateSpinner = findViewById(R.id.gateSpinner)
        status = findViewById(R.id.status)
        resultPanel = findViewById(R.id.resultPanel)
        resultTitle = findViewById(R.id.resultTitle)
        resultName = findViewById(R.id.resultName)
        resultDetail = findViewById(R.id.resultDetail)
        torch = findViewById(R.id.torch)

        val user = store.userJson?.let { runCatching { JSONObject(it) }.getOrNull() }
        findViewById<TextView>(R.id.agentName).text =
            listOfNotNull(user?.optString("name")?.ifBlank { null }, store.serverUrl.removePrefix("https://")).joinToString(" · ")

        resultPanel.setOnClickListener { handler.removeCallbacks(hideResult); resultPanel.visibility = View.GONE }
        findViewById<Button>(R.id.logout).setOnClickListener { confirmLogout() }
        findViewById<Button>(R.id.manual).setOnClickListener { manualEntry() }
        findViewById<Button>(R.id.sync).setOnClickListener { lifecycleScope.launch { syncNow(manual = true) } }
        torch.setOnClickListener { toggleTorch() }

        val listener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (buildingSpinners) return
                store.eventId = eventIds.getOrElse(eventSpinner.selectedItemPosition) { "" }
                store.gate = gates.getOrElse(gateSpinner.selectedItemPosition) { "" }
                updateStatus()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
        eventSpinner.onItemSelectedListener = listener
        gateSpinner.onItemSelectedListener = listener

        tone = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 100) }.getOrNull()
        applyState()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
        else askCamera.launch(Manifest.permission.CAMERA)

        // Boucle de fond : envoi des scans hors ligne + mise à jour de la liste des billets.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    syncNow(manual = false)
                    delay(15_000)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        scanner?.close()
        tone?.release()
    }

    // ---------------------------------------------------------------------
    // Caméra
    // ---------------------------------------------------------------------
    private fun startCamera() {
        val sc = BarcodeScanning.getClient(BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build())
        scanner = sc
        val executor = ContextCompat.getMainExecutor(this)
        val c = LifecycleCameraController(this)
        c.setEnabledUseCases(CameraController.IMAGE_ANALYSIS)
        c.setImageAnalysisAnalyzer(executor, MlKitAnalyzer(listOf(sc), CameraController.COORDINATE_SYSTEM_VIEW_REFERENCED, executor) { result ->
            val value = result?.getValue(sc)?.firstOrNull()?.rawValue
            if (!value.isNullOrBlank()) onScanned(value)
        })
        c.bindToLifecycle(this)
        preview.controller = c
        controller = c
    }

    private fun toggleTorch() {
        val c = controller ?: return
        torchOn = !torchOn
        c.enableTorch(torchOn)
        torch.text = if (torchOn) "Lampe ✓" else "Lampe"
    }

    // ---------------------------------------------------------------------
    // Scan
    // ---------------------------------------------------------------------
    private fun onScanned(raw: String) {
        val now = System.currentTimeMillis()
        if (processing || resultPanel.visibility == View.VISIBLE) return
        if (raw == lastValue && now - lastValueAt < 4000) return
        lastValue = raw; lastValueAt = now
        check(raw)
    }

    private fun check(raw: String) {
        processing = true
        val gate = gates.getOrElse(gateSpinner.selectedItemPosition) { "Portique" }
        val eventId = eventIds.getOrElse(eventSpinner.selectedItemPosition) { "" }
        lifecycleScope.launch {
            try {
                val body = JSONObject().put("code", raw).put("gate", gate)
                if (eventId.isNotBlank()) body.put("eventId", eventId)
                val res = withContext(Dispatchers.IO) { api.call("POST", "/api/scan", body) }
                setOnline(true)
                when {
                    res.code == 401 -> return@launch sessionExpired()
                    !res.ok -> showResult(Tone.WARN, "ERREUR", "", res.error)
                    else -> showServerResult(res.body.optJSONObject("result") ?: JSONObject())
                }
            } catch (e: IOException) {
                setOnline(false)
                offlineCheck(raw, gate, eventId)
            } finally {
                processing = false
            }
        }
    }

    private fun showServerResult(r: JSONObject) {
        val pass = r.optJSONObject("pass")
        val name = pass?.optString("holderName").orEmpty()
        val tier = listOfNotNull(pass?.optString("tierName")?.ifBlank { null }, pass?.optString("passCode")?.ifBlank { null }).joinToString(" · ")
        when (r.optString("outcome")) {
            "valid_entry" -> showResult(Tone.OK, "ENTRÉE OK", name, tier)
            "fraud_duplicate" -> showResult(Tone.WARN, "DÉJÀ ENTRÉ", name,
                "Billet déjà scanné le ${formatDate(r.optString("previousCheckIn"))}" +
                    (pass?.optString("checkedInGate")?.ifBlank { null }?.let { " — $it" } ?: "") + "\n$tier")
            "blacklisted" -> showResult(Tone.KO, "BILLET BLOQUÉ", name, "Annulé ou bloqué par l'organisateur.\n$tier")
            else -> when {
                r.optBoolean("eventClosed") -> showResult(Tone.KO, "REFUSÉ", name, "Événement clôturé (${pass?.optString("eventTitle")})")
                r.optBoolean("wrongEvent") -> showResult(Tone.KO, "AUTRE ÉVÉNEMENT", name, "Ce billet est pour : ${pass?.optString("eventTitle")}")
                else -> showResult(Tone.KO, "BILLET INVALIDE", "", "Code inconnu ou QR falsifié.")
            }
        }
        // L'état local sera rafraîchi au prochain cycle ; on reflète déjà l'entrée.
        if (r.optString("outcome") == "valid_entry") lifecycleScope.launch { syncNow(manual = false) }
    }

    /** Contrôle sans réseau, sur la liste des billets reçue lors de la dernière synchronisation. */
    private fun offlineCheck(raw: String, gate: String, eventId: String) {
        val code = extractCode(raw)
        val pass = store.passes()[code]
        val suffix = "\n(hors ligne — sera synchronisé)"
        when {
            code.isBlank() || pass == null -> showResult(Tone.KO, "BILLET INVALIDE", "", "Code inconnu dans la liste locale.\n(hors ligne)")
            eventId.isNotBlank() && pass.eventId != eventId -> showResult(Tone.KO, "AUTRE ÉVÉNEMENT", pass.holderName, "Ce billet est pour : ${pass.eventTitle}")
            pass.status == "blacklisted" || pass.status == "cancelled" -> showResult(Tone.KO, "BILLET BLOQUÉ", pass.holderName, pass.tierName)
            pass.status == "used" || code in store.usedLocally() -> showResult(Tone.WARN, "DÉJÀ ENTRÉ", pass.holderName, "${pass.tierName} · ${pass.code}\n(hors ligne)")
            else -> {
                store.enqueue(code, gate, isoNow())
                showResult(Tone.OK, "ENTRÉE OK", pass.holderName, "${pass.tierName} · ${pass.code}$suffix")
            }
        }
        updateStatus()
    }

    private fun extractCode(raw: String): String {
        val s = raw.trim()
        if (s.startsWith("{")) {
            runCatching { return JSONObject(s).optString("code").trim().uppercase() }
        }
        return s.substringBefore('#').trim().uppercase()
    }

    private fun manualEntry() {
        val input = EditText(this).apply {
            hint = "Ex. E01-ABCD234567"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            filters = arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(40))
        }
        val box = FrameLayout(this).apply {
            val pad = (20 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad / 2, pad, 0)
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle("Saisir le code du billet")
            .setView(box)
            .setPositiveButton("Vérifier") { _, _ ->
                val code = input.text.toString().trim()
                if (code.isNotBlank() && !processing) check(code)
            }
            .setNegativeButton("Annuler", null)
            .show()
    }

    // ---------------------------------------------------------------------
    // Affichage du résultat
    // ---------------------------------------------------------------------
    private enum class Tone { OK, WARN, KO }

    private fun showResult(t: Tone, title: String, name: String, detail: String) {
        val color = when (t) { Tone.OK -> R.color.ok; Tone.WARN -> R.color.warn; Tone.KO -> R.color.ko }
        resultPanel.setBackgroundColor(ContextCompat.getColor(this, color))
        resultTitle.text = title
        resultName.text = name
        resultName.visibility = if (name.isBlank()) View.GONE else View.VISIBLE
        resultDetail.text = detail
        resultPanel.visibility = View.VISIBLE
        handler.removeCallbacks(hideResult)
        handler.postDelayed(hideResult, if (t == Tone.OK) 2500 else 5000)

        tone?.startTone(if (t == Tone.OK) ToneGenerator.TONE_PROP_ACK else ToneGenerator.TONE_SUP_ERROR, if (t == Tone.OK) 200 else 700)
        vibrate(if (t == Tone.OK) longArrayOf(0, 80) else longArrayOf(0, 250, 120, 250))
    }

    @Suppress("DEPRECATION")
    private fun vibrate(pattern: LongArray) {
        val v = getSystemService(Vibrator::class.java) ?: return
        if (!v.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1)) else v.vibrate(pattern, -1)
    }

    // ---------------------------------------------------------------------
    // Synchronisation
    // ---------------------------------------------------------------------
    private suspend fun syncNow(manual: Boolean) {
        if (!syncLock.tryLock()) return
        try {
            val queue = store.queue()
            var rejected = 0
            if (queue.length() > 0) {
                val res = withContext(Dispatchers.IO) { api.call("POST", "/api/scan/sync", JSONObject().put("scans", queue)) }
                if (res.code == 401) return sessionExpired()
                if (res.ok) {
                    store.dropQueued(queue.length())
                    val results = res.body.optJSONObject("result")?.optJSONArray("results") ?: JSONArray()
                    for (i in 0 until results.length()) if (results.optJSONObject(i)?.optString("outcome") != "valid_entry") rejected++
                }
            }
            val since = store.stateVersion
            val res = withContext(Dispatchers.IO) { api.call("GET", "/api/state" + if (since > 0) "?since=$since" else "") }
            if (res.code == 401) return sessionExpired()
            if (res.code == 403) { // mot de passe provisoire non changé
                store.cookie = null
                return sessionExpired()
            }
            if (res.ok && !res.body.optBoolean("unchanged")) {
                store.saveState(res.body)
                if (store.queue().length() == 0) store.clearUsedLocally()
                applyState()
            }
            setOnline(true)
            if (rejected > 0) Toast.makeText(this, "$rejected scan(s) hors ligne refusé(s) par le serveur (déjà entrés ailleurs ?) — voir le journal.", Toast.LENGTH_LONG).show()
            else if (manual) Toast.makeText(this, "Synchronisé", Toast.LENGTH_SHORT).show()
        } catch (e: IOException) {
            setOnline(false)
            if (manual) Toast.makeText(this, "Serveur injoignable : les scans restent en attente.", Toast.LENGTH_LONG).show()
        } finally {
            syncLock.unlock()
            updateStatus()
        }
    }

    /** Remplit les listes événement / porte à partir de l'état reçu, en gardant la sélection. */
    private fun applyState() {
        val state = store.state() ?: JSONObject()
        val settings = state.optJSONObject("settings") ?: JSONObject()
        findViewById<TextView>(R.id.orgName).text = settings.optString("organizationName").ifBlank { "KolaPass" }

        val events = state.optJSONArray("events") ?: JSONArray()
        val evList = (0 until events.length()).mapNotNull { events.optJSONObject(it) }.sortedBy { it.optString("eventDate") }
        eventIds = listOf("") + evList.map { it.optString("id") }
        val evLabels = listOf("Tous les événements") + evList.map { "${it.optString("title")} — ${formatDate(it.optString("eventDate"))}" }

        val gArr = settings.optJSONArray("gates") ?: JSONArray()
        gates = (0 until gArr.length()).map { gArr.optString(it) }.filter { it.isNotBlank() }.ifEmpty { listOf("Portique") }

        buildingSpinners = true
        eventSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, evLabels)
        gateSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, gates.map { "Porte : $it" })
        eventSpinner.setSelection(eventIds.indexOf(store.eventId).coerceAtLeast(0), false)
        gateSpinner.setSelection(gates.indexOf(store.gate).coerceAtLeast(0), false)
        // Les écouteurs reçoivent l'événement de sélection après coup : on lève le drapeau ensuite.
        eventSpinner.post { buildingSpinners = false }
        updateStatus()
    }

    private fun setOnline(v: Boolean) { online = v; updateStatus() }

    private fun updateStatus() {
        val eventId = eventIds.getOrElse(eventSpinner.selectedItemPosition) { "" }
        val used = store.usedLocally()
        val list = store.passes().values.filter { (eventId.isBlank() || it.eventId == eventId) && it.status != "cancelled" }
        val entered = list.count { it.status == "used" || it.code in used }
        val pending = store.queue().length()
        status.text = buildString {
            append(if (online) "● En ligne" else "○ HORS LIGNE")
            append(" · $entered/${list.size} entrés")
            if (pending > 0) append(" · $pending en attente d'envoi")
        }
        status.setTextColor(ContextCompat.getColor(this, if (online) R.color.ok else R.color.warn))
    }

    // ---------------------------------------------------------------------
    // Session
    // ---------------------------------------------------------------------
    private fun sessionExpired() {
        Toast.makeText(this, "Session expirée : reconnectez-vous.", Toast.LENGTH_LONG).show()
        store.cookie = null
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    private fun confirmLogout() {
        val pending = store.queue().length()
        AlertDialog.Builder(this)
            .setTitle("Se déconnecter ?")
            .setMessage(if (pending > 0) "$pending scan(s) hors ligne n'ont pas encore été envoyés. Ils seront envoyés à la prochaine connexion sur ce téléphone." else "Vous devrez saisir à nouveau votre mot de passe.")
            .setPositiveButton("Déconnexion") { _, _ ->
                lifecycleScope.launch {
                    runCatching { withContext(Dispatchers.IO) { api.call("POST", "/api/auth/logout") } }
                    store.logout()
                    startActivity(Intent(this@ScanActivity, LoginActivity::class.java))
                    finish()
                }
            }
            .setNegativeButton("Annuler", null)
            .show()
    }

    // ---------------------------------------------------------------------
    private fun isoNow(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

    private fun formatDate(iso: String?): String {
        if (iso.isNullOrBlank()) return ""
        return runCatching {
            val p = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
            val d = p.parse(iso.take(19)) ?: return iso
            SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.FRANCE).format(d)
        }.getOrDefault(iso)
    }
}

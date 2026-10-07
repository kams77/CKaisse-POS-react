package cd.kolapass.scan

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class LoginActivity : AppCompatActivity() {
    private lateinit var store: Store
    private lateinit var api: Api

    private lateinit var server: EditText
    private lateinit var login: EditText
    private lateinit var password: EditText
    private lateinit var changeBlock: View
    private lateinit var newPassword: EditText
    private lateinit var confirmPassword: EditText
    private lateinit var error: TextView
    private lateinit var submit: Button
    private lateinit var progress: ProgressBar

    /** true quand le serveur exige le remplacement du mot de passe provisoire. */
    private var mustChange = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        store = Store(this)
        api = Api(store)

        server = findViewById(R.id.server)
        login = findViewById(R.id.login)
        password = findViewById(R.id.password)
        changeBlock = findViewById(R.id.changeBlock)
        newPassword = findViewById(R.id.newPassword)
        confirmPassword = findViewById(R.id.confirmPassword)
        error = findViewById(R.id.error)
        submit = findViewById(R.id.submit)
        progress = findViewById(R.id.progress)

        server.setText(store.serverUrl)
        login.setText(store.lastLogin)
        submit.setOnClickListener { onSubmit() }
        password.setOnEditorActionListener { _, id, _ ->
            if (id == EditorInfo.IME_ACTION_DONE) { onSubmit(); true } else false
        }

        // Session encore valide : on passe directement au scan.
        if (store.cookie != null && store.serverUrl.isNotBlank()) checkSession()
    }

    private fun checkSession() {
        busy(true)
        lifecycleScope.launch {
            val res = runCatching { withContext(Dispatchers.IO) { api.call("GET", "/api/auth/me") } }.getOrNull()
            busy(false)
            when {
                res == null -> if (store.stateJson != null) openScanner() // hors ligne : on garde la session locale
                res.ok && res.body.optJSONObject("user")?.optBoolean("mustChangePassword") == true -> {
                    showChange()
                }
                res.ok -> { store.userJson = res.body.optJSONObject("user")?.toString(); openScanner() }
                else -> store.cookie = null
            }
        }
    }

    private fun normalizeUrl(raw: String): String {
        var s = raw.trim().trimEnd('/')
        if (s.isBlank()) return s
        if (!s.startsWith("http://", true) && !s.startsWith("https://", true)) s = "https://$s"
        return s
    }

    private fun onSubmit() {
        hideError()
        val url = normalizeUrl(server.text.toString())
        val id = login.text.toString().trim().lowercase()
        val pwd = password.text.toString()
        if (url.isBlank()) return showError("Indiquez l'adresse du serveur.")
        if (id.isBlank() || pwd.isBlank()) return showError("Identifiant et mot de passe obligatoires.")
        if (mustChange) return changePassword(pwd)

        if (url.startsWith("http://", true) && !isLocal(url)) {
            AlertDialog.Builder(this)
                .setTitle("Connexion non chiffrée")
                .setMessage("L'adresse commence par http:// : le mot de passe circulera en clair. À n'utiliser que sur le réseau local du site. Continuer ?")
                .setPositiveButton("Continuer") { _, _ -> doLogin(url, id, pwd) }
                .setNegativeButton("Annuler", null)
                .show()
        } else doLogin(url, id, pwd)
    }

    private fun isLocal(url: String): Boolean {
        val host = Regex("^https?://([^/:]+)", RegexOption.IGNORE_CASE).find(url)?.groupValues?.get(1) ?: return false
        return host == "localhost" || host.endsWith(".local") || host.startsWith("10.") ||
            host.startsWith("192.168.") || Regex("^172\\.(1[6-9]|2\\d|3[01])\\.").containsMatchIn(host)
    }

    private fun doLogin(url: String, id: String, pwd: String) {
        if (url != store.serverUrl) { store.logout(); store.serverUrl = url }
        server.setText(url)
        store.lastLogin = id
        busy(true)
        lifecycleScope.launch {
            val res = runCatching {
                withContext(Dispatchers.IO) { api.call("POST", "/api/auth/login", JSONObject().put("login", id).put("password", pwd)) }
            }
            busy(false)
            res.onFailure { showError("Serveur injoignable : vérifiez l'adresse et le réseau (Wi-Fi / données).\n(${it.message})") }
            res.onSuccess { r ->
                if (!r.ok) return@onSuccess showError(r.error)
                val user = r.body.optJSONObject("user")
                if (user == null) return@onSuccess showError("Réponse inattendue du serveur.")
                if (user.optBoolean("mustChangePassword")) showChange()
                else { store.userJson = user.toString(); openScanner() }
            }
        }
    }

    private fun showChange() {
        mustChange = true
        changeBlock.visibility = View.VISIBLE
        submit.text = "Enregistrer et continuer"
        newPassword.requestFocus()
    }

    private fun changePassword(current: String) {
        val np = newPassword.text.toString()
        if (np.length < 10) return showError("Le nouveau mot de passe doit faire au moins 10 caractères.")
        if (np != confirmPassword.text.toString()) return showError("Les deux mots de passe ne correspondent pas.")
        busy(true)
        lifecycleScope.launch {
            val res = runCatching {
                withContext(Dispatchers.IO) {
                    // Session absente (ex. appli relancée) : on se reconnecte d'abord.
                    if (store.cookie == null) {
                        val l = api.call("POST", "/api/auth/login", JSONObject().put("login", login.text.toString().trim().lowercase()).put("password", current))
                        if (!l.ok) return@withContext l
                    }
                    api.call("POST", "/api/auth/password", JSONObject().put("currentPassword", current).put("newPassword", np))
                }
            }
            busy(false)
            res.onFailure { showError("Serveur injoignable (${it.message}).") }
            res.onSuccess { r ->
                if (!r.ok) return@onSuccess showError(r.error)
                store.userJson = r.body.optJSONObject("user")?.toString()
                mustChange = false
                openScanner()
            }
        }
    }

    private fun openScanner() {
        startActivity(Intent(this, ScanActivity::class.java))
        finish()
    }

    private fun busy(b: Boolean) {
        progress.visibility = if (b) View.VISIBLE else View.GONE
        submit.isEnabled = !b
    }

    private fun showError(msg: String) {
        error.text = msg
        error.visibility = View.VISIBLE
    }

    private fun hideError() { error.visibility = View.GONE }
}

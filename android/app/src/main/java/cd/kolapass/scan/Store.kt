package cd.kolapass.scan

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Billet tel que l'agent le reçoit (sans téléphone ni montant). */
data class CachedPass(
    val code: String,
    val eventId: String,
    val holderName: String,
    val tierName: String,
    val status: String,
    val eventTitle: String,
)

/**
 * Préférences et cache local : session, choix événement/porte, dernier état reçu
 * (pour le contrôle hors connexion) et file des scans à synchroniser.
 */
class Store(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("kolapass", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server", "") ?: ""
        set(v) = prefs.edit().putString("server", v).apply()

    var cookie: String?
        get() = prefs.getString("cookie", null)
        set(v) = prefs.edit().putString("cookie", v).apply()

    var lastLogin: String
        get() = prefs.getString("login", "") ?: ""
        set(v) = prefs.edit().putString("login", v).apply()

    var userJson: String?
        get() = prefs.getString("user", null)
        set(v) = prefs.edit().putString("user", v).apply()

    var eventId: String
        get() = prefs.getString("eventId", "") ?: ""
        set(v) = prefs.edit().putString("eventId", v).apply()

    var gate: String
        get() = prefs.getString("gate", "") ?: ""
        set(v) = prefs.edit().putString("gate", v).apply()

    var stateJson: String?
        get() = prefs.getString("state", null)
        set(v) = prefs.edit().putString("state", v).apply()

    var stateVersion: Long
        get() = prefs.getLong("version", 0)
        set(v) = prefs.edit().putLong("version", v).apply()

    // ----- Billets en cache -----
    @Volatile private var passIndex: Map<String, CachedPass>? = null

    fun passes(): Map<String, CachedPass> {
        passIndex?.let { return it }
        val map = HashMap<String, CachedPass>()
        val arr = stateJson?.let { runCatching { JSONObject(it).optJSONArray("passes") }.getOrNull() } ?: JSONArray()
        for (i in 0 until arr.length()) {
            val p = arr.optJSONObject(i) ?: continue
            val code = p.optString("passCode").uppercase()
            if (code.isBlank()) continue
            map[code] = CachedPass(
                code, p.optString("eventId"), p.optString("holderName"), p.optString("tierName"),
                p.optString("status"), p.optString("eventTitle"),
            )
        }
        passIndex = map
        return map
    }

    fun saveState(json: JSONObject) {
        stateJson = json.toString()
        stateVersion = json.optLong("version", 0)
        passIndex = null
    }

    fun state(): JSONObject? = stateJson?.let { runCatching { JSONObject(it) }.getOrNull() }

    // ----- File hors connexion -----
    fun queue(): JSONArray = runCatching { JSONArray(prefs.getString("queue", "[]")) }.getOrDefault(JSONArray())

    fun enqueue(code: String, gate: String, timestamp: String) {
        val q = queue()
        q.put(JSONObject().put("passCode", code).put("gate", gate).put("timestamp", timestamp))
        prefs.edit().putString("queue", q.toString()).apply()
        markUsedLocally(code)
    }

    /** Retire les n premiers éléments (synchronisés avec succès). */
    fun dropQueued(n: Int) {
        val q = queue()
        val rest = JSONArray()
        for (i in n until q.length()) rest.put(q.get(i))
        prefs.edit().putString("queue", rest.toString()).apply()
    }

    fun usedLocally(): Set<String> = prefs.getStringSet("usedLocal", emptySet()) ?: emptySet()

    private fun markUsedLocally(code: String) {
        prefs.edit().putStringSet("usedLocal", usedLocally() + code).apply()
    }

    fun clearUsedLocally() = prefs.edit().remove("usedLocal").apply()

    /** Déconnexion : on garde l'adresse du serveur et l'identifiant, pas la session ni le cache. */
    fun logout() {
        val keepQueue = queue().length() > 0
        prefs.edit().apply {
            remove("cookie"); remove("user"); remove("state"); remove("version")
            if (!keepQueue) remove("usedLocal")
        }.apply()
        passIndex = null
    }
}

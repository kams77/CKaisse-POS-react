package cd.kolapass.scan

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Réponse HTTP du serveur KolaPass. */
data class ApiResponse(val code: Int, val body: JSONObject) {
    val ok get() = code in 200..299
    val error: String get() = body.optString("error").ifBlank { "Erreur serveur ($code)" }
}

/**
 * Client minimal de l'API KolaPass (aucune dépendance) : cookie de session conservé
 * dans les préférences, en-tête anti-CSRF ajouté à chaque requête.
 * Les appels sont bloquants : à lancer sur Dispatchers.IO.
 */
class Api(private val store: Store) {

    @Throws(IOException::class)
    fun call(method: String, path: String, body: JSONObject? = null): ApiResponse {
        val base = store.serverUrl.trimEnd('/')
        if (base.isBlank()) throw IOException("Adresse du serveur non configurée")
        val conn = (URL(base + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8000
            readTimeout = 8000
            useCaches = false
            instanceFollowRedirects = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-Requested-With", "kolapass")
            setRequestProperty("User-Agent", "KolaPassScan/Android")
            store.cookie?.let { setRequestProperty("Cookie", "kp_session=$it") }
        }
        try {
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            conn.headerFields["Set-Cookie"]?.forEach { header ->
                val m = Regex("^kp_session=([^;]*)").find(header.trim())
                if (m != null) store.cookie = m.groupValues[1].ifBlank { null }
            }
            val stream = if (code >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val json = try {
                if (text.isBlank()) JSONObject() else JSONObject(text)
            } catch (e: Exception) {
                if (code in 300..399) JSONObject().put("error", "Redirection : vérifiez l'adresse (https:// ?)")
                else JSONObject().put("error", "Réponse inattendue : est-ce bien un serveur KolaPass ?")
            }
            return ApiResponse(code, json)
        } finally {
            conn.disconnect()
        }
    }
}

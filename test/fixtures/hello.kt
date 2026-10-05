package demo

fun greeting(name: String): String = "Hello, $name"

fun main() {
    val who = "Kotlin"
    println(greeting(who))
}

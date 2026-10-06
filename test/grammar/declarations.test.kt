// SYNTAX TEST "source.kotlin" "declarations"
package com.example.app
// <------- keyword.other.package.kotlin
//      ^^^^^^^^^^^^^^^ entity.name.package.kotlin
import kotlin.math.max as maximum
// <------ keyword.other.import.kotlin
//     ^^^^^^^^^^^^^^ entity.name.package.kotlin
//                     ^^ keyword.other.import.as.kotlin
//                        ^^^^^^^ entity.name.type.alias.kotlin

fun main(args: Array<String>) {
// <--- storage.type.function.kotlin
//  ^^^^ entity.name.function.kotlin
//             ^^^^^ entity.name.type.kotlin
}

suspend fun <T> List<T>.second(): T = this[1]
// <------- storage.modifier.kotlin
//      ^^^ storage.type.function.kotlin
//           ^ entity.name.type.parameter.kotlin
//              ^^^^ entity.name.type.kotlin
//                      ^^^^^^ entity.name.function.kotlin
//                                    ^^^^ variable.language.this.kotlin

data class Point(val x: Int, var y: Int)
// <---- storage.modifier.kotlin
//   ^^^^^ storage.type.class.kotlin
//         ^^^^^ entity.name.type.class.kotlin
//               ^^^ storage.type.variable.kotlin
//                   ^ variable.other.declaration.kotlin
//                      ^^^ entity.name.type.kotlin

sealed interface Shape
// <------ storage.modifier.kotlin
//     ^^^^^^^^^ storage.type.class.kotlin
//               ^^^^^ entity.name.type.class.kotlin

fun interface Runner
// <--- storage.modifier.kotlin
//  ^^^^^^^^^ storage.type.class.kotlin
//            ^^^^^^ entity.name.type.class.kotlin

class Box {
    companion object {
//  ^^^^^^^^^ storage.modifier.kotlin
//            ^^^^^^ storage.type.kotlin
        const val MAX_SIZE = 10
//      ^^^^^ storage.modifier.kotlin
//                ^^^^^^^^ variable.other.declaration.kotlin
    }
    var size: Int = 0
        private set
//      ^^^^^^^ storage.modifier.kotlin
//              ^^^ storage.type.accessor.kotlin
    init {
//  ^^^^ keyword.other.init.kotlin
    }
}

@file:JvmName("Main")
// <------------ storage.type.annotation.kotlin
@Deprecated("x")
// <----------- storage.type.annotation.kotlin

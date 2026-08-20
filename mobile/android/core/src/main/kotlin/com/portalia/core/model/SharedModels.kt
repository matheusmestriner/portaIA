package com.portalia.core.model

import kotlinx.serialization.Serializable

@Serializable
data class Paginated<T>(
    val items: List<T>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)

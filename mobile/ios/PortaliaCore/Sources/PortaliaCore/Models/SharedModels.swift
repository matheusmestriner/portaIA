import Foundation

public struct Paginated<T: Decodable>: Decodable {
    public let items: [T]
    public let page: Int
    public let pageSize: Int
    public let total: Int
}

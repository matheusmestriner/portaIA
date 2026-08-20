// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PortaliaCore",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "PortaliaCore", targets: ["PortaliaCore"])
    ],
    targets: [
        .target(name: "PortaliaCore"),
        .testTarget(name: "PortaliaCoreTests", dependencies: ["PortaliaCore"]),
    ]
)

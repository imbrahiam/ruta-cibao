import SceneKit
import SwiftUI

/// Little low-poly models of how you travel (car, motorcycle, person, bicycle), built from
/// SceneKit primitives in code: no model files to ship or license. They stand in for the blue
/// dot during navigation, turned the way you are heading.
enum VehicleModels {
    /// The model faces +Z; the puck turns it to the heading.
    static func node(for mode: RouteNavigator.Mode) -> SCNNode {
        switch mode {
        case .drive: car()
        case .moto: motorcycle()
        case .walk: person()
        case .bike: bicycle()
        }
    }

    static func service(_ name: String) -> SCNNode {
        switch name {
        case "parking": return car()
        case "guide": return hiker()
        case "food": return utensils()
        default: break
        }
        let root = SCNNode()
        let green = paint(body)
        let white = paint(light)
        switch name {
        case "water":
            let blue = paint(UIColor(red: 0.22, green: 0.54, blue: 0.71, alpha: 1))
            root.addChildNode(box(0.92, 1.64, 0.82, chamfer: 0.29, blue, at: SCNVector3(0, 0.83, 0)))
            root.addChildNode(box(0.94, 0.42, 0.85, chamfer: 0.16, white, at: SCNVector3(0, 0.78, 0)))
            root.addChildNode(box(0.46, 0.25, 0.42, chamfer: 0.08, green, at: SCNVector3(0, 1.72, 0)))
        case "lodging":
            root.addChildNode(box(1.44, 0.38, 2.06, chamfer: 0.1, green, at: SCNVector3(0, 0.26, 0)))
            root.addChildNode(box(1.41, 0.90, 0.16, chamfer: 0.08, green, at: SCNVector3(0, 0.56, -0.98)))
            root.addChildNode(box(1.35, 0.24, 1.86, chamfer: 0.1, white, at: SCNVector3(0, 0.54, 0)))
            root.addChildNode(box(1.21, 0.19, 0.40, chamfer: 0.08, white, at: SCNVector3(0, 0.72, -0.60)))
            root.addChildNode(box(1.40, 0.12, 1.07, chamfer: 0.06, green, at: SCNVector3(0, 0.67, 0.30)))
        default:
            root.addChildNode(box(0.90, 0.92, 0.58, chamfer: 0.12, white, at: SCNVector3(0, 0.80, -0.45)))
            root.addChildNode(box(0.65, 0.58, 0.78, chamfer: 0.18, white, at: SCNVector3(0, 0.29, 0.09)))
            root.addChildNode(box(0.94, 0.36, 1.00, chamfer: 0.17, white, at: SCNVector3(0, 0.58, 0.15)))
            root.addChildNode(box(0.67, 0.04, 0.66, chamfer: 0.02, green, at: SCNVector3(0, 0.77, 0.17)))
        }
        return root
    }

    static func place(_ type: PlaceModel) -> SCNNode {
        switch type {
        case .car: return car()
        case .bike: return bicycle()
        case .hiker: return hiker()
        case .lodging: return service("lodging")
        case .food: return utensils()
        default: break
        }

        let root = SCNNode()
        // A leaf green, not the brand's pine: the chips sit on the pine header, where a
        // pine model disappears.
        let pine = paint(leaf)
        let cream = paint(UIColor(red: 0.99, green: 0.96, blue: 0.87, alpha: 1))
        let blue = paint(UIColor(red: 0.27, green: 0.64, blue: 0.79, alpha: 1))
        let coral = paint(UIColor(red: 0.79, green: 0.27, blue: 0.21, alpha: 1))
        let gold = paint(UIColor(red: 0.94, green: 0.66, blue: 0.27, alpha: 1))
        let brown = paint(UIColor(red: 0.46, green: 0.31, blue: 0.22, alpha: 1))
        let dark = paint(glass)

        func block(_ width: CGFloat, _ height: CGFloat, _ depth: CGFloat, _ material: SCNMaterial,
                   _ x: Float = 0, _ y: Float = 0, _ z: Float = 0, chamfer: CGFloat = 0.06) {
            root.addChildNode(box(width, height, depth, chamfer: chamfer, material, at: SCNVector3(x, y, z)))
        }

        func add(_ geometry: SCNGeometry, _ material: SCNMaterial, at point: SCNVector3) -> SCNNode {
            let node = SCNNode(geometry: geometry)
            node.geometry?.materials = [material]
            node.position = point
            root.addChildNode(node)
            return node
        }

        switch type {
        case .swimming:
            // A life ring (🛟): coral with four cream bands, tipped toward the camera.
            let ring = SCNNode()
            ring.addChildNode({ let n = SCNNode(geometry: SCNTorus(ringRadius: 0.56, pipeRadius: 0.19)); n.geometry?.materials = [coral]; return n }())
            for index in 0..<4 {
                let pivot = SCNNode()
                pivot.eulerAngles.y = Float(index) * .pi / 2 + .pi / 4
                let band = SCNNode(geometry: SCNCylinder(radius: 0.2, height: 0.24))
                band.geometry?.materials = [cream]
                band.eulerAngles.x = .pi / 2
                band.position = SCNVector3(0.56, 0, 0)
                pivot.addChildNode(band)
                ring.addChildNode(pivot)
            }
            ring.eulerAngles.x = 1.05
            root.addChildNode(ring)
        case .medical:
            block(0.61, 0.33, 0.27, dark, 0, 0.64)
            block(0.31, 0.14, 0.28, cream, 0, 0.65)
            block(1.52, 1.04, 0.66, coral, chamfer: 0.16)
            block(0.60, 0.19, 0.07, cream, 0, -0.01, 0.34, chamfer: 0.025)
            block(0.19, 0.60, 0.07, cream, 0, -0.01, 0.34, chamfer: 0.025)
        case .school:
            _ = add(SCNCylinder(radius: 0.47, height: 0.39), blue, at: SCNVector3(0, 0, 0))
            block(1.30, 0.12, 1.30, blue, 0, 0.26, chamfer: 0.035)
            _ = add(SCNCylinder(radius: 0.055, height: 0.40), gold, at: SCNVector3(0.52, 0.08, 0.55))
            _ = add(SCNSphere(radius: 0.10), gold, at: SCNVector3(0.52, -0.13, 0.55))
        case .civic:
            block(1.61, 0.18, 1.05, cream, 0, -0.47)
            block(1.38, 0.88, 0.68, pine, 0, -0.01, -0.12)
            for x: Float in [-0.49, 0, 0.49] {
                _ = add(SCNCylinder(radius: 0.095, height: 0.85), cream, at: SCNVector3(x, 0, 0.35))
            }
            block(1.68, 0.16, 1.05, cream, 0, 0.47)
            _ = add(SCNPyramid(width: 1.68, height: 0.45, length: 1.05), cream, at: SCNVector3(0, 0.53, 0))
        case .park:
            _ = add(SCNCylinder(radius: 0.14, height: 1.17), brown, at: SCNVector3(0, -0.20, 0))
            _ = add(SCNCone(topRadius: 0.10, bottomRadius: 0.68, height: 1.18), pine, at: SCNVector3(0, 0.23, 0))
            _ = add(SCNCone(topRadius: 0, bottomRadius: 0.53, height: 1.04), pine, at: SCNVector3(0, 0.66, 0))
        case .bus:
            block(1.09, 1.12, 2.26, gold, 0, 0.13, chamfer: 0.15)
            block(0.94, 0.43, 0.07, dark, 0, 0.32, 1.11)
            for x: Float in [-0.55, 0.55] {
                block(0.045, 0.39, 1.77, dark, x, 0.35, -0.08)
                for z: Float in [-0.66, 0.66] {
                    root.addChildNode(wheel(radius: 0.24, width: 0.21, at: SCNVector3(x, -0.37, z)))
                }
                block(0.16, 0.12, 0.05, cream, x * 0.69, -0.22, 1.13)
            }
        case .sports:
            block(0.81, 0.18, 0.67, brown, 0, -0.62)
            _ = add(SCNCylinder(radius: 0.15, height: 0.46), gold, at: SCNVector3(0, -0.34, 0))
            _ = add(SCNCone(topRadius: 0.53, bottomRadius: 0.25, height: 0.70), gold, at: SCNVector3(0, 0.20, 0))
            for x: Float in [-0.50, 0.50] {
                let handle = add(SCNTorus(ringRadius: 0.19, pipeRadius: 0.065), gold, at: SCNVector3(x, 0.27, 0))
                handle.eulerAngles.x = .pi / 2
            }
        case .church:
            block(1.12, 0.87, 1.21, cream, 0, -0.34, -0.14)
            _ = add(SCNPyramid(width: 1.28, height: 0.54, length: 1.31), coral, at: SCNVector3(0, 0.10, -0.14))
            block(0.54, 1.36, 0.51, cream, 0, -0.09, 0.54)
            _ = add(SCNPyramid(width: 0.68, height: 0.41, length: 0.66), coral, at: SCNVector3(0, 0.58, 0.54))
            block(0.30, 0.39, 0.035, brown, 0, -0.57, 0.80, chamfer: 0.04)
            block(0.25, 0.07, 0.07, gold, 0, 1.12, 0.54, chamfer: 0.02)
            block(0.07, 0.30, 0.07, gold, 0, 1.08, 0.54, chamfer: 0.02)
        case .farm:
            for offset: Float in [-0.36, 0, 0.36] {
                let top = 0.68 - abs(offset)
                root.addChildNode(rod(from: SCNVector3(0, -0.66, 0), to: SCNVector3(offset, top, 0), radius: 0.052, pine))
                for level in 0..<3 {
                    let y = top - Float(level) * 0.19
                    let grain = add(SCNSphere(radius: 0.15), gold, at: SCNVector3(offset, y, 0))
                    grain.scale = SCNVector3(0.58, 1.02, 0.57)
                }
            }
        case .market:
            _ = add(SCNCone(topRadius: 0.71, bottomRadius: 0.52, height: 0.58), brown, at: SCNVector3(0, -0.15, 0))
            for (x, z, material) in [(-0.31, 0.15, coral), (0.27, 0.23, gold), (0.12, -0.30, pine)] {
                _ = add(SCNSphere(radius: 0.27), material, at: SCNVector3(Float(x), 0.17, Float(z)))
            }
            let handle = add(SCNTorus(ringRadius: 0.56, pipeRadius: 0.062), cream, at: SCNVector3(0, 0.12, 0))
            handle.eulerAngles.x = .pi / 2
        case .pharmacy:
            for (x, material) in [(-0.34, blue), (0.34, coral)] {
                let capsule = add(SCNCapsule(capRadius: 0.27, height: 1.28), material, at: SCNVector3(Float(x), 0, 0))
                capsule.eulerAngles.z = x < 0 ? -0.31 : 0.37
                let waist = add(SCNCylinder(radius: 0.274, height: 0.16), cream, at: capsule.position)
                waist.eulerAngles = capsule.eulerAngles
            }
        case .fuel:
            block(0.92, 1.45, 0.65, coral, 0, 0.04, chamfer: 0.10)
            block(0.67, 0.40, 0.08, cream, 0, 0.30, 0.34)
            block(0.47, 0.20, 0.025, dark, 0, 0.29, 0.39)
            block(1.07, 0.15, 0.83, dark, 0, -0.73)
            root.addChildNode(rod(from: SCNVector3(0.49, 0.26, 0), to: SCNVector3(0.74, -0.47, 0.15), radius: 0.076, dark))
            block(0.15, 0.41, 0.20, dark, 0.74, -0.30, 0.23)
        case .buildings:
            for (x, z, height, material) in [(-0.37, -0.09, 1.37, blue), (0.36, 0.16, 0.99, pine)] {
                block(0.66, height, 0.69, material, Float(x), 0, Float(z))
                for level in [-0.19, 0.12, 0.42] where level < height / 2 - 0.05 {
                    block(0.42, 0.10, 0.03, cream, Float(x), Float(level), Float(z + 0.35), chamfer: 0.018)
                }
            }
        case .repair:
            root.addChildNode(rod(from: SCNVector3(-0.62, -0.68, 0), to: SCNVector3(0.22, 0.39, 0), radius: 0.10, cream))
            let wrench = UIBezierPath()
            wrench.move(to: CGPoint(x: -0.26, y: 0.18))
            wrench.addLine(to: CGPoint(x: -0.15, y: 0.38))
            wrench.addLine(to: CGPoint(x: -0.10, y: 0.14))
            wrench.addLine(to: CGPoint(x: 0.10, y: 0.14))
            wrench.addLine(to: CGPoint(x: 0.15, y: 0.38))
            wrench.addLine(to: CGPoint(x: 0.26, y: 0.18))
            wrench.addQuadCurve(to: CGPoint(x: -0.26, y: 0.18), controlPoint: CGPoint(x: 0, y: -0.40))
            wrench.close()
            let head = SCNShape(path: wrench, extrusionDepth: 0.17)
            head.chamferRadius = 0.03
            let jaw = add(head, cream, at: SCNVector3(0.26, 0.44, 0))
            jaw.eulerAngles.z = -0.57
            root.addChildNode(rod(from: SCNVector3(0.32, -0.29, 0.15), to: SCNVector3(-0.32, 0.63, 0.15), radius: 0.06, cream))
            root.addChildNode(rod(from: SCNVector3(0.57, -0.66, 0.15), to: SCNVector3(0.26, -0.22, 0.15), radius: 0.15, coral))
        case .coffee:
            _ = add(SCNCylinder(radius: 0.70, height: 0.12), cream, at: SCNVector3(0, -0.47, 0))
            _ = add(SCNCone(topRadius: 0.48, bottomRadius: 0.31, height: 0.70), cream, at: SCNVector3(0, -0.03, 0))
            _ = add(SCNCylinder(radius: 0.405, height: 0.035), brown, at: SCNVector3(0, 0.33, 0))
            let handle = add(SCNTorus(ringRadius: 0.20, pipeRadius: 0.067), cream, at: SCNVector3(0.52, -0.02, 0))
            handle.eulerAngles.x = .pi / 2
        case .flag, .finishFlag:
            _ = add(SCNCylinder(radius: 0.07, height: 1.53), cream, at: SCNVector3(-0.47, 0, 0))
            if type == .finishFlag {
                for row in 0..<2 {
                    for column in 0..<3 {
                        block(0.28, 0.26, 0.10, (row + column).isMultiple(of: 2) ? cream : dark,
                              Float(column - 1) * 0.28, 0.33 + Float(row) * 0.26, chamfer: 0.01)
                    }
                }
            } else {
                block(0.86, 0.54, 0.10, gold, 0, 0.46, 0, chamfer: 0.035)
                block(0.34, 0.54, 0.11, pine, 0.26, 0.46, 0, chamfer: 0.035)
            }
        case .placeCheck:
            _ = add(SCNSphere(radius: 0.52), pine, at: SCNVector3(-0.31, 0.29, 0))
            _ = add(SCNCone(topRadius: 0.44, bottomRadius: 0.04, height: 0.85), pine,
                    at: SCNVector3(-0.31, -0.29, 0))
            _ = add(SCNSphere(radius: 0.16), cream, at: SCNVector3(-0.31, 0.31, 0.48))
            let lens = add(SCNTorus(ringRadius: 0.34, pipeRadius: 0.079), gold, at: SCNVector3(0.33, 0.12, 0.49))
            lens.eulerAngles.x = .pi / 2
            root.addChildNode(rod(from: SCNVector3(0.57, -0.13, 0.49), to: SCNVector3(0.85, -0.53, 0.49), radius: 0.095, brown))
        case .adventure:
            let lime = paint(UIColor(red: 0.52, green: 0.78, blue: 0.36, alpha: 1))
            let forest = paint(UIColor(red: 0.16, green: 0.46, blue: 0.31, alpha: 1))
            let orange = paint(UIColor(red: 0.95, green: 0.50, blue: 0.20, alpha: 1))
            // The main peak, faceted, with a pale rocky top.
            _ = add(SCNPyramid(width: 1.5, height: 1.3, length: 1.1), pine, at: SCNVector3(-0.1, 0, 0))
            _ = add(SCNPyramid(width: 0.5, height: 0.43, length: 0.37), paint(light), at: SCNVector3(-0.1, 0.875, 0))
            // A lower, sunlit peak in front of it.
            _ = add(SCNPyramid(width: 1.0, height: 0.82, length: 0.8), lime, at: SCNVector3(0.55, 0, 0.3))
            // The flag planted on the summit.
            root.addChildNode(rod(from: SCNVector3(-0.1, 1.25, 0), to: SCNVector3(-0.1, 1.66, 0), radius: 0.035, brown))
            block(0.42, 0.26, 0.05, orange, 0.12, 1.52, 0, chamfer: 0.02)
            // A pine at the foot of the trail.
            _ = add(SCNCylinder(radius: 0.05, height: 0.16), brown, at: SCNVector3(-0.78, 0.08, 0.5))
            _ = add(SCNCone(topRadius: 0, bottomRadius: 0.22, height: 0.5), forest, at: SCNVector3(-0.78, 0.4, 0.5))
        case .car, .bike, .hiker, .lodging, .food: break
        }
        return root
    }

    private static func utensils() -> SCNNode {
        let root = SCNNode()
        let steel = paint(UIColor(white: 0.86, alpha: 1), metal: 0.55, rough: 0.3)
        let handle = paint(UIColor(red: 0.82, green: 0.50, blue: 0.25, alpha: 1))
        for x: Float in [-0.46, 0.46] {
            root.addChildNode(box(0.19, 1.10, 0.13, chamfer: 0.06, handle, at: SCNVector3(x, -0.36, 0)))
            root.addChildNode(box(0.13, 0.45, 0.10, chamfer: 0.035, steel, at: SCNVector3(x, 0.30, 0)))
        }
        root.addChildNode(box(0.53, 0.19, 0.10, chamfer: 0.035, steel, at: SCNVector3(-0.46, 0.48, 0)))
        for x: Float in [-0.68, -0.53, -0.39, -0.24] {
            root.addChildNode(box(0.085, 0.43, 0.10, chamfer: 0.032, steel, at: SCNVector3(x, 0.72, 0)))
        }
        let bowl = SCNSphere(radius: 0.35)
        bowl.materials = [steel]
        let spoon = SCNNode(geometry: bowl)
        spoon.position = SCNVector3(0.46, 0.64, 0)
        spoon.scale = SCNVector3(0.84, 1.03, 0.25)
        root.addChildNode(spoon)
        return root
    }

    private static func hiker() -> SCNNode {
        let root = person(shirt: UIColor(red: 0.27, green: 0.64, blue: 0.79, alpha: 1), trousers: UIColor(red: 0.58, green: 0.47, blue: 0.34, alpha: 1))
        let pack = paint(UIColor(red: 0.83, green: 0.51, blue: 0.21, alpha: 1))
        root.addChildNode(box(0.47, 0.62, 0.31, chamfer: 0.12, pack, at: SCNVector3(0, 1.39, -0.28)))
        root.addChildNode(rod(from: SCNVector3(0.49, 0.03, 0.35), to: SCNVector3(0.36, 1.24, 0.19), radius: 0.035, paint(glass)))
        return root
    }

    // MARK: Materials

    private static func paint(_ color: UIColor, metal: Double = 0.1, rough: Double = 0.45) -> SCNMaterial {
        let material = SCNMaterial()
        material.lightingModel = .physicallyBased
        material.diffuse.contents = color
        material.metalness.contents = metal
        material.roughness.contents = rough
        return material
    }

    private static let body = UIColor(red: 0x28 / 255, green: 0x59 / 255, blue: 0x4A / 255, alpha: 1)
    private static let leaf = UIColor(red: 0.27, green: 0.66, blue: 0.42, alpha: 1)
    private static let glass = UIColor(white: 0.12, alpha: 1)
    private static let tyre = UIColor(white: 0.08, alpha: 1)
    private static let light = UIColor(white: 0.97, alpha: 1)
    private static let skin = UIColor(red: 0.55, green: 0.38, blue: 0.27, alpha: 1)

    private static func box(_ w: CGFloat, _ h: CGFloat, _ l: CGFloat, chamfer: CGFloat, _ material: SCNMaterial, at position: SCNVector3) -> SCNNode {
        let geometry = SCNBox(width: w, height: h, length: l, chamferRadius: chamfer)
        geometry.materials = [material]
        let node = SCNNode(geometry: geometry)
        node.position = position
        return node
    }

    private static func wheel(radius: CGFloat, width: CGFloat, at position: SCNVector3) -> SCNNode {
        let geometry = SCNCylinder(radius: radius, height: width)
        geometry.materials = [paint(tyre, rough: 0.8)]
        let node = SCNNode(geometry: geometry)
        node.eulerAngles.z = .pi / 2
        node.position = position
        return node
    }

    private static func rod(from a: SCNVector3, to b: SCNVector3, radius: CGFloat, _ material: SCNMaterial) -> SCNNode {
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        let length = CGFloat(sqrt(dx * dx + dy * dy + dz * dz))
        let geometry = SCNCylinder(radius: radius, height: length)
        geometry.materials = [material]
        let node = SCNNode(geometry: geometry)
        node.position = SCNVector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
        // A cylinder stands on Y; point it from a to b.
        node.look(at: b, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 1, 0))
        return node
    }

    // MARK: Models

    private static func car() -> SCNNode {
        let root = SCNNode()
        let shell = paint(body, metal: 0.35, rough: 0.3)
        root.addChildNode(box(1.8, 0.55, 4.0, chamfer: 0.22, shell, at: SCNVector3(0, 0.55, 0)))
        // The cabin, set back, with dark glass all round.
        root.addChildNode(box(1.6, 0.5, 2.1, chamfer: 0.25, paint(glass, metal: 0.2, rough: 0.1), at: SCNVector3(0, 1.02, -0.25)))
        root.addChildNode(box(1.62, 0.08, 1.9, chamfer: 0.04, shell, at: SCNVector3(0, 1.3, -0.25)))
        for (x, z) in [(-0.86, 1.25), (0.86, 1.25), (-0.86, -1.3), (0.86, -1.3)] {
            root.addChildNode(wheel(radius: 0.36, width: 0.28, at: SCNVector3(Float(x), 0.36, Float(z))))
        }
        // Headlights forward, so the heading reads at a glance.
        for x in [-0.6, 0.6] { root.addChildNode(box(0.36, 0.14, 0.06, chamfer: 0.04, paint(light, rough: 0.1), at: SCNVector3(Float(x), 0.66, 2.01))) }
        return root
    }

    private static func motorcycle() -> SCNNode {
        let root = SCNNode()
        let shell = paint(body, metal: 0.35, rough: 0.3)
        let chrome = paint(UIColor(white: 0.75, alpha: 1), metal: 0.9, rough: 0.2)
        root.addChildNode(wheel(radius: 0.42, width: 0.16, at: SCNVector3(0, 0.42, 0.95)))
        root.addChildNode(wheel(radius: 0.42, width: 0.18, at: SCNVector3(0, 0.42, -0.95)))
        root.addChildNode(box(0.36, 0.42, 1.2, chamfer: 0.16, shell, at: SCNVector3(0, 0.82, 0)))
        root.addChildNode(box(0.3, 0.12, 0.7, chamfer: 0.06, paint(glass), at: SCNVector3(0, 1.08, -0.35)))
        root.addChildNode(rod(from: SCNVector3(0, 0.42, 0.95), to: SCNVector3(0, 1.2, 0.62), radius: 0.04, chrome))
        root.addChildNode(rod(from: SCNVector3(-0.38, 1.2, 0.6), to: SCNVector3(0.38, 1.2, 0.6), radius: 0.03, chrome))
        root.addChildNode(box(0.2, 0.12, 0.06, chamfer: 0.03, paint(light), at: SCNVector3(0, 1.0, 0.82)))
        return root
    }

    private static func person(shirt shirtColor: UIColor = body, trousers trousersColor: UIColor = UIColor(white: 0.22, alpha: 1)) -> SCNNode {
        let root = SCNNode()
        let shirt = paint(shirtColor, rough: 0.7)
        let trousers = paint(trousersColor, rough: 0.8)
        let legs = SCNCapsule(capRadius: 0.13, height: 0.95)
        legs.materials = [trousers]
        for x in [-0.14, 0.14] {
            let leg = SCNNode(geometry: legs)
            leg.position = SCNVector3(Float(x), 0.48, 0)
            root.addChildNode(leg)
        }
        let torso = SCNCapsule(capRadius: 0.27, height: 0.85)
        torso.materials = [shirt]
        let torsoNode = SCNNode(geometry: torso)
        torsoNode.position = SCNVector3(0, 1.32, 0)
        root.addChildNode(torsoNode)
        let head = SCNSphere(radius: 0.2)
        head.materials = [paint(skin, rough: 0.6)]
        let headNode = SCNNode(geometry: head)
        headNode.position = SCNVector3(0, 1.95, 0)
        root.addChildNode(headNode)
        // A cap's brim points the way they walk.
        root.addChildNode(box(0.3, 0.04, 0.22, chamfer: 0.02, shirt, at: SCNVector3(0, 2.07, 0.16)))
        return root
    }

    private static func bicycle() -> SCNNode {
        let root = SCNNode()
        let frame = paint(body, metal: 0.4, rough: 0.3)
        for z in [0.62, -0.62] {
            let rim = SCNTorus(ringRadius: 0.4, pipeRadius: 0.045)
            rim.materials = [paint(tyre, rough: 0.8)]
            let node = SCNNode(geometry: rim)
            node.eulerAngles.z = .pi / 2
            node.position = SCNVector3(0, 0.42, Float(z))
            root.addChildNode(node)
        }
        let rear = SCNVector3(0, 0.42, -0.62), front = SCNVector3(0, 0.42, 0.62)
        let seat = SCNVector3(0, 1.0, -0.2), bars = SCNVector3(0, 1.08, 0.5), crank = SCNVector3(0, 0.45, 0)
        for (a, b) in [(rear, seat), (seat, crank), (crank, rear), (seat, bars), (bars, crank), (bars, front)] {
            root.addChildNode(rod(from: a, to: b, radius: 0.035, frame))
        }
        root.addChildNode(box(0.2, 0.06, 0.28, chamfer: 0.03, paint(glass), at: SCNVector3(0, 1.05, -0.22)))
        root.addChildNode(rod(from: SCNVector3(-0.28, 1.1, 0.5), to: SCNVector3(0.28, 1.1, 0.5), radius: 0.025, frame))
        return root
    }
}

/// The traveller on the map: the chosen model on a soft shadow, seen from above and behind,
/// turned to the heading relative to the map's own rotation.
struct VehiclePuck: View {
    let mode: RouteNavigator.Mode
    /// Heading in degrees, already relative to the map (course minus the camera's heading).
    var heading: Double = 0
    var size: CGFloat = 64

    @State private var scene: SCNScene?
    @State private var holder = SCNNode()

    var body: some View {
        ClearScene(scene: scene)
            .frame(width: size, height: size)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear { scene = makeScene() }
            .onChange(of: mode) { _, _ in scene = makeScene() }
            .onChange(of: heading) { _, angle in
                SCNTransaction.begin()
                SCNTransaction.animationDuration = 0.4
                holder.eulerAngles.y = Float(-angle * .pi / 180)
                SCNTransaction.commit()
            }
    }

    private func makeScene() -> SCNScene {
        let scene = SCNScene()
        scene.background.contents = UIColor.clear
        let holder = SCNNode()
        let model = VehicleModels.node(for: mode)
        // Every model is scaled to the same footprint, whatever its real size.
        let (low, high) = model.boundingBox
        let span = max(high.x - low.x, high.z - low.z, high.y - low.y)
        let scale = 3.2 / max(span, 0.01)
        model.scale = SCNVector3(scale, scale, scale)
        model.position.y = -Float(low.y) * scale
        holder.addChildNode(model)
        holder.eulerAngles.y = Float(-heading * .pi / 180)
        scene.rootNode.addChildNode(holder)
        self.holder = holder

        // A soft disc of shadow to sit it on the street.
        let shadow = SCNPlane(width: 3.2, height: 3.2)
        let material = SCNMaterial()
        material.diffuse.contents = UIImage.radialShadow
        material.lightingModel = .constant
        material.isDoubleSided = true
        shadow.materials = [material]
        let floor = SCNNode(geometry: shadow)
        floor.eulerAngles.x = -.pi / 2
        floor.position.y = 0.01
        scene.rootNode.addChildNode(floor)

        let camera = SCNCamera()
        camera.fieldOfView = 34
        let eye = SCNNode()
        eye.camera = camera
        eye.position = SCNVector3(0, 6.2, -6.2)
        eye.look(at: SCNVector3(0, 0.6, 0))
        scene.rootNode.addChildNode(eye)

        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.intensity = 900
        sun.eulerAngles = SCNVector3(-Float.pi / 3, Float.pi / 4, 0)
        scene.rootNode.addChildNode(sun)
        return scene
    }
}

/// A SceneKit view with a see-through background, so the model stands on the map itself
/// (SwiftUI's `SceneView` paints an opaque white square behind it).
private struct ClearScene: UIViewRepresentable {
    let scene: SCNScene?

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.backgroundColor = .clear
        view.isOpaque = false
        view.antialiasingMode = .multisampling4X
        view.autoenablesDefaultLighting = true
        view.isUserInteractionEnabled = false
        view.scene = scene
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {
        if view.scene !== scene { view.scene = scene }
    }
}

enum PlaceModel: String {
    case swimming, medical, school, civic, park, bus, sports, church, farm, market
    case food, lodging, pharmacy, fuel, buildings, repair, car, coffee, hiker, bike, flag, finishFlag, placeCheck
    /// Eco routes as a whole: a peak with a flag on top and a pine at its foot.
    case adventure

    init?(icon: String) {
        switch icon {
        // A drop is drinking water (a consultation topic), not a swimming spot.
        case "waves": self = .swimming
        case "cross": self = .medical
        case "graduation-cap": self = .school
        case "landmark": self = .civic
        case "trees": self = .park
        case "bus": self = .bus
        case "trophy": self = .sports
        case "church": self = .church
        case "wheat": self = .farm
        case "shopping-basket", "store": self = .market
        case "utensils": self = .food
        case "bed-double": self = .lodging
        case "pill": self = .pharmacy
        case "fuel": self = .fuel
        case "building-2": self = .buildings
        case "wrench": self = .repair
        case "car": self = .car
        case "coffee": self = .coffee
        case "footprints": self = .hiker
        case "bike": self = .bike
        case "flag": self = .flag
        default: return nil
        }
    }

    /// How much a model catches the eye on the pine header, highest first; the header lists
    /// the brightest kinds first so the row opens with colour.
    var vividness: Int {
        switch self {
        case .adventure, .swimming, .church, .bus, .fuel, .pharmacy: 3
        case .medical, .market, .sports, .buildings, .coffee, .food, .hiker: 2
        case .park, .farm, .civic, .school, .lodging, .flag: 1
        default: 0
        }
    }

    var image: UIImage {
        ModelThumbnail.picture(key: "place:" + rawValue) { VehicleModels.place(self) }
    }
}

struct RouteServiceModel: View {
    let service: String

    var body: some View {
        let name = service.lowercased()
        Image(uiImage: ModelThumbnail.picture(key: "service:" + name) { VehicleModels.service(name) })
            .resizable()
            .scaledToFit()
            .padding(5)
    }
}

private enum ModelThumbnail {
    private static var pictures: [String: UIImage] = [:]

    static func picture(key: String, model makeModel: () -> SCNNode) -> UIImage {
        if let picture = pictures[key] { return picture }
        let scene = SCNScene()
        scene.background.contents = UIColor.clear
        let model = makeModel()
        let (low, high) = model.boundingBox
        let center = SCNVector3((low.x + high.x) / 2, (low.y + high.y) / 2, (low.z + high.z) / 2)
        scene.rootNode.addChildNode(model)

        let camera = SCNNode()
        let lens = SCNCamera()
        lens.usesOrthographicProjection = true
        lens.orthographicScale = Double(max(high.x - low.x, high.y - low.y, high.z - low.z)) * 0.68
        camera.camera = lens
        camera.position = SCNVector3(center.x + 4, center.y + 3, center.z + 6)
        camera.look(at: center)
        scene.rootNode.addChildNode(camera)

        let renderer = SCNRenderer(device: nil, options: nil)
        renderer.scene = scene
        renderer.pointOfView = camera
        renderer.autoenablesDefaultLighting = true
        let rendered = renderer.snapshot(atTime: 0, with: CGSize(width: 144, height: 144), antialiasingMode: .multisampling4X)
        let picture = trimmed(rendered)
        pictures[key] = picture
        return picture
    }

    private static func trimmed(_ image: UIImage) -> UIImage {
        guard let source = image.cgImage else { return image }
        let width = source.width, height = source.height
        guard let context = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        ), let data = context.data else { return image }
        context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
        let pixels = data.assumingMemoryBound(to: UInt8.self)
        var left = width, top = height, right = -1, bottom = -1
        for y in 0..<height {
            for x in 0..<width where pixels[(y * width + x) * 4 + 3] > 12 {
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
            }
        }
        guard left <= right, top <= bottom else { return image }
        let canvas = CGRect(x: 0, y: 0, width: width, height: height)
        let bounds = CGRect(x: left, y: top, width: right - left + 1, height: bottom - top + 1)
            .insetBy(dx: -2, dy: -2).intersection(canvas)
        guard let cropped = context.makeImage()?.cropping(to: bounds) else { return image }
        return UIImage(cgImage: cropped)
    }

}

private extension UIImage {
    /// A black-to-clear radial gradient, drawn once.
    static let radialShadow: UIImage = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64)).image { context in
        let colors = [UIColor.black.withAlphaComponent(0.35).cgColor, UIColor.clear.cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            context.cgContext.drawRadialGradient(gradient, startCenter: CGPoint(x: 32, y: 32), startRadius: 0, endCenter: CGPoint(x: 32, y: 32), endRadius: 32, options: [])
        }
    }
}

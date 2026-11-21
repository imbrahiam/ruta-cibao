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

    private static func person() -> SCNNode {
        let root = SCNNode()
        let shirt = paint(body, rough: 0.7)
        let trousers = paint(UIColor(white: 0.22, alpha: 1), rough: 0.8)
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
        SceneView(scene: scene, pointOfView: nil, options: [.autoenablesDefaultLighting], antialiasingMode: .multisampling4X)
            .frame(width: size, height: size)
            .background(Color.clear)
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

private extension UIImage {
    /// A black-to-clear radial gradient, drawn once.
    static let radialShadow: UIImage = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64)).image { context in
        let colors = [UIColor.black.withAlphaComponent(0.35).cgColor, UIColor.clear.cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            context.cgContext.drawRadialGradient(gradient, startCenter: CGPoint(x: 32, y: 32), startRadius: 0, endCenter: CGPoint(x: 32, y: 32), endRadius: 32, options: [])
        }
    }
}

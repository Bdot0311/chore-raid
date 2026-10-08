"""The Mess King, modelled in Blender from the concept art (docs/concept-art/king.png).

    /path/to/python-with-bpy tools/blender/king.py public/models/ai/king.glb

Metaball slime remeshed and sculpted with noise, grime painted into the vertex
colours, a crown, embedded garbage, a face and a cape. Faces -Y in Blender,
which is +Z (towards the hero) in the game.
"""

import math
import random
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[-1]
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def vc_mat(name, rough=0.25):
    """A material that shows the mesh's painted vertex colours."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    return m


def obj_active(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


# ------------------------------------------------------------------ the slime body
mb = bpy.data.metaballs.new("slime")
mb.resolution = 0.06
mb.threshold = 0.5
body = bpy.data.objects.new("body", mb)
scene.collection.objects.link(body)


def ball(x, y, z, r, sx=1, sy=1, sz=1, kind="ELLIPSOID"):
    e = mb.elements.new(type=kind)
    e.co = (x, y, z)
    e.radius = r
    e.size_x, e.size_y, e.size_z = sx, sy, sz
    e.stiffness = 2.6
    return e


ball(0, 0, 1.1, 1.25, 1.05, 0.95, 1.0)  # the gut
ball(0, -0.3, 0.8, 1.0, 1.0, 0.8, 0.8)  # belly sagging forward
ball(0, -0.05, 1.95, 0.85, 1.0, 0.9, 0.8)  # head, sunk into the shoulders
for s in (-1, 1):
    ball(s * 0.85, 0, 1.75, 0.7, 1.0, 0.9, 0.8)  # shoulders
    ball(s * 1.25, -0.1, 1.3, 0.55, 0.7, 0.7, 1.0)  # upper arm
    ball(s * 1.35, -0.2, 0.85, 0.5, 0.7, 0.7, 0.8)  # forearm
    ball(s * 1.35, -0.3, 0.5, 0.42)  # fist
    ball(s * 0.55, -0.05, 0.25, 0.55, 0.9, 0.9, 0.6)  # stubby leg
# Drips and dribbles.
for _ in range(14):
    a = random.uniform(-0.9, 0.9)
    ball(math.sin(a) * 1.05, -math.cos(a) * 0.95, random.uniform(0.15, 1.2), random.uniform(0.12, 0.2), 0.6, 0.6, 1.8)

obj_active(body)
bpy.ops.object.convert(target="MESH")
body = bpy.context.view_layer.objects.active
# Even topology, then a lumpy sculpted surface.
rm = body.modifiers.new("remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.035
bpy.ops.object.modifier_apply(modifier="remesh")
tex = bpy.data.textures.new("lumps", "CLOUDS")
tex.noise_scale = 0.35
disp = body.modifiers.new("lumps", "DISPLACE")
disp.texture = tex
disp.strength = 0.07
bpy.ops.object.modifier_apply(modifier="lumps")
tex2 = bpy.data.textures.new("pores", "VORONOI")
tex2.noise_scale = 0.08
disp2 = body.modifiers.new("pores", "DISPLACE")
disp2.texture = tex2
disp2.strength = -0.015
bpy.ops.object.modifier_apply(modifier="pores")
smooth(body)

# Grime painted into the vertex colours: dark in the creases, sicklier on top.
me = body.data
col = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
bpy.ops.object.mode_set(mode="VERTEX_PAINT")
bpy.ops.object.mode_set(mode="OBJECT")
base = Vector((0.26, 0.42, 0.06))
for v in me.vertices:
    n = math.sin(v.co.x * 7.1) * math.sin(v.co.y * 6.3) * math.sin(v.co.z * 5.7)
    c = base.copy()
    c += Vector((0.06, 0.08, 0.0)) * n
    if v.co.z > 1.9:
        c = c.lerp(Vector((0.36, 0.5, 0.1)), 0.4)
    if n > 0.55:
        c = c.lerp(Vector((0.3, 0.22, 0.08)), 0.6)  # brown stains
    col.data[v.index].color = (c.x, c.y, c.z, 1)
obj_active(body)
bpy.ops.object.mode_set(mode="VERTEX_PAINT")
bpy.ops.paint.vertex_color_dirt(blur_strength=1, blur_iterations=2, clean_angle=3.0, dirt_angle=0.0, dirt_only=True)
bpy.ops.object.mode_set(mode="OBJECT")
body.data.materials.append(vc_mat("slime", 0.18))

# ------------------------------------------------------------------ the face
dark = mat("mouth", (0.05, 0.01, 0.01), 0.6)
white = mat("eye", (0.95, 0.92, 0.82), 0.25)
red = mat("iris", (1, 0.08, 0.02), 0.3, emit=(1, 0.1, 0.02), emit_strength=6)
tooth = mat("tooth", (0.88, 0.8, 0.52), 0.45)
brow_m = mat("brow", (0.1, 0.16, 0.02), 0.6)

face_y = -0.78
for s in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(s * 0.27, face_y, 2.05))
    e = bpy.context.object
    e.scale = (1, 0.6, 0.85)
    e.data.materials.append(white)
    smooth(e)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(s * 0.25, face_y - 0.13, 2.03))
    i = bpy.context.object
    i.data.materials.append(red)
    smooth(i)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 0.27, face_y - 0.05, 2.22))
    b = bpy.context.object
    b.scale = (0.24, 0.08, 0.06)
    b.rotation_euler = (0, s * 0.45, 0)
    b.data.materials.append(brow_m)
    bv = b.modifiers.new("bevel", "BEVEL")
    bv.width = 0.03
    bv.segments = 3

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.4, location=(0, face_y + 0.1, 1.72))
mouth = bpy.context.object
mouth.scale = (1.05, 0.35, 0.32)
mouth.data.materials.append(dark)
smooth(mouth)
for k in range(9):
    x = (k / 8 - 0.5) * 0.66
    for top in (True, False):
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.045, depth=0.13, location=(x + random.uniform(-0.02, 0.02), face_y - 0.04, 1.84 if top else 1.6))
        t = bpy.context.object
        t.rotation_euler = (math.pi if top else 0, random.uniform(-0.2, 0.2), 0)
        t.data.materials.append(tooth)

# ------------------------------------------------------------------ crown
gold = mat("gold", (1, 0.72, 0.18), 0.35, 0.45, emit=(0.4, 0.25, 0.02), emit_strength=0.6)
gem_r = mat("ruby", (0.9, 0.05, 0.05), 0.1, emit=(1, 0.1, 0.05), emit_strength=2)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.42, depth=0.22, location=(0.05, 0.05, 2.42))
crown = bpy.context.object
crown.rotation_euler = (0.08, -0.22, 0)
crown.data.materials.append(gold)
sol = crown.modifiers.new("solid", "SOLIDIFY")
sol.thickness = 0.04
for k in range(7):
    a = k / 7 * math.tau
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.08, depth=0.3, location=(0.05 + math.sin(a) * 0.4, 0.05 - math.cos(a) * 0.4, 2.64))
    sp = bpy.context.object
    sp.data.materials.append(gold)
    sp.parent = None
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=(0.05 + math.sin(a) * 0.4, 0.05 - math.cos(a) * 0.4, 2.81))
    g = bpy.context.object
    g.data.materials.append(gem_r)

# ------------------------------------------------------------------ garbage stuck in him
plate_m = mat("plate", (0.62, 0.6, 0.48), 0.4)
crumbs = mat("food", (0.55, 0.32, 0.12), 0.8)
sock_m = mat("sock", (0.85, 0.85, 0.9), 0.9)
stripe_m = mat("stripe", (0.3, 0.45, 0.9), 0.9)
pizza_m = mat("pizza", (0.95, 0.65, 0.2), 0.7)
pep_m = mat("pepperoni", (0.7, 0.12, 0.08), 0.6)
for loc, rot in (((0.55, -1.0, 1.15), (1.35, 0.2, 0.3)), ((-0.65, -0.9, 0.7), (1.2, -0.3, -0.2))):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.22, depth=0.03, location=loc, rotation=rot)
    p = bpy.context.object
    p.data.materials.append(plate_m)
    for _ in range(4):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.04, location=(loc[0] + random.uniform(-0.15, 0.15), loc[1] - 0.03, loc[2] + random.uniform(-0.15, 0.15)))
        bpy.context.object.data.materials.append(crumbs)
# A slice of pizza on his chest.
bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.32, depth=0.05, location=(-0.3, -1.05, 1.35), rotation=(1.4, 0, 0.5))
bpy.context.object.data.materials.append(pizza_m)
for k in range(3):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=0.02, location=(-0.3 + random.uniform(-0.1, 0.1), -1.09, 1.35 + random.uniform(-0.1, 0.1)), rotation=(1.4, 0, 0))
    bpy.context.object.data.materials.append(pep_m)
# Socks dangling off him.
for loc in ((-1.1, -0.6, 1.0), (0.95, -0.75, 0.45)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.07, depth=0.35, location=loc, rotation=(0.3, 0.2, 0))
    bpy.context.object.data.materials.append(sock_m)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.02, location=(loc[0], loc[1], loc[2] + 0.15))
    bpy.context.object.data.materials.append(stripe_m)

# ------------------------------------------------------------------ cape
cape_m = mat("cape", (0.22, 0.13, 0.07), 0.95)
# Half a cone, open at the front, hanging from the shoulders.
bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=1.55, radius2=0.95, depth=1.9, end_fill_type="NOTHING", location=(0, 0.1, 1.15))
cape = bpy.context.object
cape.data.materials.append(cape_m)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.subdivide(number_cuts=6)
bpy.ops.object.mode_set(mode="OBJECT")
me = cape.data
import bmesh
bm = bmesh.new()
bm.from_mesh(me)
# Keep only the back half, and tear the hem.
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.15], context="VERTS")
for v in bm.verts:
    v.co.x *= 1 + math.sin(v.co.z * 5) * 0.04
    if v.co.z < -0.7 and random.random() < 0.45:
        v.co.z += random.uniform(0.1, 0.3)
bm.to_mesh(me)
bm.free()
sol = cape.modifiers.new("solid", "SOLIDIFY")
sol.thickness = 0.03
smooth(cape)

# ------------------------------------------------------------------ export
for o in scene.objects:
    if o.type == "MESH":
        obj_active(o)
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
body_tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if body_tris > 60000:
    obj_active(body)
    d = body.modifiers.new("dec", "DECIMATE")
    d.ratio = 60000 / body_tris
    bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_apply=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False)
print("tris", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == "MESH"))

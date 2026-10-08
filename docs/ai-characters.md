# AI-made characters

Any creature's body can be swapped for a detailed model made with an AI 3D tool
(Meshy, Tripo, Rodin). The creature keeps its aura (flies, slime, orbiting junk),
its narration and its moves; the model is sized to fit automatically.

## Making a model

Text to 3D, stylised (cartoon / Pixar-like, not realistic), PBR textures,
export **GLB**, roughly 20k-50k triangles. Front-facing, standing on the ground.
If the tool offers auto-rig + animations and the creature has legs, add an
**idle** animation; it will play while the creature waits. Not required.

| id | Prompt |
|---|---|
| king | A grotesque, bloated slime king made of green ooze and household garbage: dirty plates, socks, pizza boxes and banana peels stuck in his body, a crooked gold crown dripping with slime, glowing red angry eyes, a wide mouth with crooked teeth, holding a plunger like a sceptre. Stylised cartoon fantasy villain, menacing but family friendly. |
| lich | A floating ghost made from a haunted white bedsheet, ragged hem, hollow glowing purple eyes, gaping mouth, a tall purple wizard hat with a sock draped over it, holding a wooden staff with a glowing orb. Stylised cartoon fantasy. |
| warlord | A warrior golem made from a giant steel stew pot, foam and soap suds for a head with angry glowing blue eyes, a colander helmet, arms of stacked dirty plates, holding a fork-axe and a plate shield, dripping dishwater. Stylised cartoon fantasy. |
| colossus | A hulking golem built from cardboard boxes, stacked books for arms, a floor lamp sticking out of its back, tangled cables hanging off it, a box head with glowing orange eyes and a jagged mouth, carrying a picture frame shield. Stylised cartoon fantasy. |
| kraken | A slimy teal octopus monster made of bathroom grime and mould, eight tentacles, big angry yellow eyes, toothy mouth, holding a toilet brush, soap bubbles around it. Stylised cartoon fantasy. |
| dragon | A chubby dragon sewn from a blue quilted duvet, pillow nightcap, button-stitched seams, sleepy angry pink eyes, small fabric wings, puffy tail. Stylised cartoon fantasy. |
| devil | A whirlwind tornado of dust, crumbs and lint with a scary face inside it, glowing yellow eyes, debris spinning around it. Stylised cartoon fantasy. |
| troll | A troll living in a dented metal trash can, the lid open like a mouth full of teeth, glowing green eyes, long green arms holding a dustbin-lid shield and a broken mop. Stylised cartoon fantasy. |

Minions (optional): sock (sock puppet goblin with button eyes and a needle),
grease (blob of yellow kitchen grease with angry eyes and a fork), dust (fluffy
grey dust bunny with long ears), slug (teal soap-scum slug with eye stalks),
pillow (pillow imp with little red horns), crumb (biscuit beetle on six legs),
rat (bin rat wearing a tin-can helmet).

## Installing one

    node tools/ai-model.mjs path/to/model.glb king        # add a turn in degrees if it faces the wrong way: ... king 180

This shrinks the textures for phones, writes `public/models/ai/king.glb` and
lists it in `public/models/ai/manifest.json`. Remove the entry to go back to the
built-in body.

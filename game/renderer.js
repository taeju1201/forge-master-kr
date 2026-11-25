/* Forge Master TEST WORLD canvas renderer.
 * Rig, sprite, mask and mesh core adapted from 1vcian/fm
 * commit 8324dd087250f53fe97dd76b511c1da9b58a758d
 * src/components/Battle/gameView/rig.ts
 *
 * MIT License
 * 
 * Copyright (c) 2026 1vcian
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */
(function (global) {
'use strict';
const Rig = (() => {
const IDENTITY = [
    1,
    0,
    0,
    1,
    0,
    0
];
function mul(p, q) {
    return [
        p[0] * q[0] + p[2] * q[1],
        p[1] * q[0] + p[3] * q[1],
        p[0] * q[2] + p[2] * q[3],
        p[1] * q[2] + p[3] * q[3],
        p[0] * q[4] + p[2] * q[5] + p[4],
        p[1] * q[4] + p[3] * q[5] + p[5]
    ];
}
function trs(x, y, rotDeg, sx, sy) {
    const r = rotDeg * Math.PI / 180;
    const c = Math.cos(r), s = Math.sin(r);
    return [
        c * sx,
        s * sx,
        -s * sy,
        c * sy,
        x,
        y
    ];
}
const SPRITE_ALPHA = 'float:212:304273561';
const FULL_FLOATS = {
    'float:212:2526845255': 'cr',
    'float:212:4215373228': 'cg',
    'float:212:2334886179': 'cb',
    'float:212:304273561': 'ca',
    'float:212:3305885265': 'en',
    'float:212:3762991556': 'ord',
    'float:212:555744692': 'fx',
    'float:212:1444465954': 'fy',
    'float:212:4197328169': 'w',
    'float:212:2368279999': 'h',
    'float:1:2086281974': 'act'
};
function decompose(m) {
    const sx = Math.hypot(m[0], m[1]);
    const rot = Math.atan2(m[1], m[0]) * 180 / Math.PI;
    const det = m[0] * m[3] - m[1] * m[2];
    return {
        x: m[4],
        y: m[5],
        rot,
        sx,
        sy: sx > 1e-9 ? det / sx : 0
    };
}
function layerIndex(data, id) {
    const i = data.sortingLayers.findIndex((l)=>l.id === (id ?? 0));
    return i < 0 ? 1 : i;
}
class RigInstance {
    data;
    nodes = [];
    world = [];
    animated = new Map();
    sized = false;
    animRoot = 0;
    pathIndex = new Map();
    parentWorld = new Map();
    constructor(data, prefab){
        this.data = data;
        this.append(prefab, -1);
    }
    append(prefab, parent, localOverride) {
        const p = prefab ? this.data.prefabs[prefab] : undefined;
        if (!p) return -1;
        const offset = this.nodes.length;
        p.nodes.forEach((n, i)=>{
            const m = i === 0 && localOverride ? localOverride : n.m;
            const node = {
                ...n,
                p: n.p < 0 ? parent : n.p + offset,
                base: decompose(m),
                m
            };
            if (n.skinned) node.skinned = {
                ...n.skinned,
                bones: n.skinned.bones.map((b)=>b >= 0 ? b + offset : b)
            };
            if (n.anchorNode !== undefined && n.anchorNode >= 0) node.anchorNode = n.anchorNode + offset;
            this.nodes.push(node);
        });
        return offset;
    }
    find(name, from = 0) {
        for(let i = from; i < this.nodes.length; i++)if (this.nodes[i].n === name) return i;
        return -1;
    }
    setAnimRoot(node) {
        this.animRoot = node;
        this.pathIndex.clear();
        const rootPath = this.nodes[node]?.path ?? '';
        const rel = (i)=>{
            const parts = [];
            let k = i;
            while(k >= 0 && k !== node){
                parts.unshift(this.nodes[k].n);
                k = this.nodes[k].p;
            }
            return k === node ? parts.join('/') : null;
        };
        for(let i = 0; i < this.nodes.length; i++){
            const r = rel(i);
            if (r !== null && !this.pathIndex.has(r)) this.pathIndex.set(r, i);
        }
        void rootPath;
    }
    clearAnimation() {
        this.animated.clear();
    }
    applyClip(clip, time, loop, full = false) {
        if (!clip) return;
        const len = clip.length;
        let t = time;
        if (len > 0) t = loop ? (t % len + len) % len : Math.max(0, Math.min(len, t));
        const f = t * clip.rate;
        for (const cv of clip.curves){
            const idx = this.pathIndex.get(cv.path);
            if (idx === undefined) continue;
            const v = cv.v;
            let val;
            if (v.length === 1) val = v[0];
            else {
                const i0 = Math.min(v.length - 1, Math.floor(f));
                const i1 = Math.min(v.length - 1, i0 + 1);
                const a = f - Math.floor(f);
                val = v[i0] + (v[i1] - v[i0]) * a;
            }
            const o = this.animated.get(idx) ?? {};
            if (full) {
                const key = cv.prop === 'rot' ? `q${cv.c}` : FULL_FLOATS[cv.prop.split(':').slice(0, 3).join(':')];
                if (key) {
                    o[key] = val;
                    this.animated.set(idx, o);
                    continue;
                }
            }
            if (cv.prop === 'pos') {
                if (cv.c === 'x') o.x = val;
                else if (cv.c === 'y') o.y = val;
            } else if (cv.prop === 'euler') {
                if (cv.c === 'z') o.rot = val;
                else if (cv.c === 'y' && Math.abs(Math.abs(val) - 180) < 1) o.sx = -(o.sx ?? Math.abs(this.nodes[idx].base.sx));
            } else if (cv.prop === 'scale') {
                if (cv.c === 'x') o.sx = val;
                else if (cv.c === 'y') o.sy = val;
            } else if (cv.prop.startsWith(SPRITE_ALPHA)) {
                o.a = val;
            }
            this.animated.set(idx, o);
        }
    }
    addRotation(node, deg) {
        if (node < 0) return;
        const o = this.animated.get(node) ?? {};
        o.rot = (o.rot ?? this.nodes[node].base.rot) + deg;
        this.animated.set(node, o);
    }
    setLocalScale(node, sx, sy) {
        if (node < 0) return;
        const o = this.animated.get(node) ?? {};
        o.sx = sx;
        o.sy = sy;
        this.animated.set(node, o);
    }
    setActive(node, on) {
        if (node < 0) return;
        const o = this.animated.get(node) ?? {};
        o.act = on ? 1 : 0;
        this.animated.set(node, o);
    }
    setLocalPosition(node, x, y) {
        if (node < 0) return;
        const o = this.animated.get(node) ?? {};
        o.x = x;
        o.y = y;
        this.animated.set(node, o);
    }
    update(rootWorld) {
        const n = this.nodes.length;
        if (this.world.length !== n) this.world = new Array(n);
        for(let i = 0; i < n; i++){
            const nd = this.nodes[i];
            const a = this.animated.get(i);
            const b = nd.base;
            let local;
            if (a && a.qw !== undefined) {
                const qx = a.qx ?? 0, qy = a.qy ?? 0, qz = a.qz ?? 0, qw = a.qw;
                const sx = a.sx ?? b.sx, sy = a.sy ?? b.sy;
                local = [
                    (1 - 2 * (qy * qy + qz * qz)) * sx,
                    2 * (qx * qy + qz * qw) * sx,
                    2 * (qx * qy - qz * qw) * sy,
                    (1 - 2 * (qx * qx + qz * qz)) * sy,
                    a.x ?? b.x,
                    a.y ?? b.y
                ];
            } else local = a ? trs(a.x ?? b.x, a.y ?? b.y, a.rot ?? b.rot, a.sx ?? b.sx, a.sy ?? b.sy) : nd.m;
            const parent = this.parentWorld.get(i) ?? (nd.p >= 0 ? this.world[nd.p] : rootWorld);
            this.world[i] = mul(parent ?? rootWorld, local);
            if (a?.a !== undefined) nd.alpha = a.a;
            nd.live = a ? liveOf(nd, a) : undefined;
        }
    }
    isVisible(i) {
        let k = i;
        while(k >= 0){
            const nd = this.nodes[k];
            const inactive = nd.live?.active !== undefined ? !nd.live.active : !!nd.off;
            if (inactive || nd.hidden) return false;
            k = nd.p;
        }
        return true;
    }
}
function liveOf(nd, a) {
    if (a.cr === undefined && a.cg === undefined && a.cb === undefined && a.ca === undefined && a.en === undefined && a.ord === undefined && a.fx === undefined && a.fy === undefined && a.w === undefined && a.h === undefined && a.act === undefined) return undefined;
    const live = {};
    if (a.cr !== undefined || a.cg !== undefined || a.cb !== undefined || a.ca !== undefined) {
        const c = nd.c ?? [
            1,
            1,
            1,
            1
        ];
        live.c = [
            a.cr ?? c[0],
            a.cg ?? c[1],
            a.cb ?? c[2],
            a.ca ?? c[3]
        ];
    }
    if (a.en !== undefined) live.srOff = a.en < 0.5;
    if (a.ord !== undefined) live.o = Math.round(a.ord);
    if (a.fx !== undefined) live.fx = a.fx >= 0.5;
    if (a.fy !== undefined) live.fy = a.fy >= 0.5;
    if (a.w !== undefined || a.h !== undefined) {
        const d = nd.draw;
        live.size = [
            a.w ?? d?.w ?? 1,
            a.h ?? d?.h ?? 1
        ];
    }
    if (a.act !== undefined) live.active = a.act >= 0.5;
    return live;
}
const tintCache = new Map();
function tinted(img, key, def, rgb) {
    const q = (v)=>Math.round(Math.max(0, Math.min(1, v)) * 63);
    const ck = `${key}|${q(rgb[0])},${q(rgb[1])},${q(rgb[2])}`;
    let c = tintCache.get(ck);
    if (!c) {
        c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(def.w));
        c.height = Math.max(1, Math.round(def.h));
        const g = c.getContext('2d');
        g.drawImage(img, def.x, def.y, def.w, def.h, 0, 0, c.width, c.height);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(img, def.x, def.y, def.w, def.h, 0, 0, c.width, c.height);
        if (tintCache.size > 1500) tintCache.clear();
        tintCache.set(ck, c);
    }
    return c;
}
const isWhite = (c)=>c[0] > 0.995 && c[1] > 0.995 && c[2] > 0.995;
function drawSprite(ctx, data, tex, key, m, color = [
    1,
    1,
    1,
    1
], flipX = false, flipY = false, size) {
    const def = data.sprites[key];
    if (!def) return false;
    const img = tex.get(def.tex);
    if (!img) return false;
    const a = color[3] ?? 1;
    if (a <= 0.003) return true;
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    if (size) ctx.scale(size[0] / (def.ow / def.ppu || 1), size[1] / (def.oh / def.ppu || 1));
    const inv = 1 / def.ppu;
    ctx.scale(flipX ? -inv : inv, flipY ? inv : -inv);
    const left = -def.px * def.ow + def.ox;
    const top = -(1 - def.py) * def.oh + (def.oh - def.oy - def.h);
    ctx.globalAlpha *= a;
    if (isWhite(color)) ctx.drawImage(img, def.x, def.y, def.w, def.h, left, top, def.w, def.h);
    else ctx.drawImage(tinted(img, key, def, color), 0, 0, def.w, def.h, left, top, def.w, def.h);
    ctx.restore();
    return true;
}
function drawSkinned(ctx, rig, mesh, tex, color) {
    const img = mesh.tex ? tex.get(mesh.tex) : undefined;
    if (!img) return false;
    const bone = mesh.bones.map((b, k)=>mul(rig.world[b] ?? IDENTITY, mesh.bind[k] ?? IDENTITY));
    const n = mesh.v.length / 2;
    const pos = new Float64Array(n * 2);
    for(let i = 0; i < n; i++){
        const x = mesh.v[2 * i], y = mesh.v[2 * i + 1];
        let px = 0, py = 0;
        for (const [b, w] of mesh.w[i] ?? []){
            const m = bone[b];
            if (!m) continue;
            px += w * (m[0] * x + m[2] * y + m[4]);
            py += w * (m[1] * x + m[3] * y + m[5]);
        }
        pos[2 * i] = px;
        pos[2 * i + 1] = py;
    }
    const W = img.width, H = img.height;
    ctx.save();
    ctx.globalAlpha *= color[3] ?? 1;
    const base = ctx.getTransform();
    const t = mesh.tris;
    for(let k = 0; k + 2 < t.length; k += 3){
        const a = t[k], b = t[k + 1], c = t[k + 2];
        const x0 = pos[2 * a], y0 = pos[2 * a + 1], x1 = pos[2 * b], y1 = pos[2 * b + 1], x2 = pos[2 * c], y2 = pos[2 * c + 1];
        const u0 = mesh.uv[2 * a] * W, v0 = (1 - mesh.uv[2 * a + 1]) * H;
        const u1 = mesh.uv[2 * b] * W, v1 = (1 - mesh.uv[2 * b + 1]) * H;
        const u2 = mesh.uv[2 * c] * W, v2 = (1 - mesh.uv[2 * c + 1]) * H;
        const den = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
        if (Math.abs(den) < 1e-9) continue;
        const ma = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / den;
        const mb = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / den;
        const mc = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / den;
        const md = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / den;
        const me = x0 - ma * u0 - mc * v0;
        const mf = y0 - mb * u0 - md * v0;
        const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
        const grow = 1.04;
        ctx.setTransform(base);
        ctx.beginPath();
        ctx.moveTo(cx + (x0 - cx) * grow, cy + (y0 - cy) * grow);
        ctx.lineTo(cx + (x1 - cx) * grow, cy + (y1 - cy) * grow);
        ctx.lineTo(cx + (x2 - cx) * grow, cy + (y2 - cy) * grow);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        ctx.transform(ma, mb, mc, md, me, mf);
        const sx = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 1), sy = Math.max(0, Math.floor(Math.min(v0, v1, v2)) - 1);
        const sw = Math.min(W, Math.ceil(Math.max(u0, u1, u2)) + 1) - sx, sh = Math.min(H, Math.ceil(Math.max(v0, v1, v2)) + 1) - sy;
        if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
        ctx.restore();
    }
    ctx.restore();
    return true;
}
let maskScratch = null;
function drawMasked(ctx, inside, sprite, shapes) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (!maskScratch) maskScratch = [
        document.createElement('canvas'),
        document.createElement('canvas')
    ];
    const [a, b] = maskScratch;
    for (const c of [
        a,
        b
    ])if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
    }
    const ga = a.getContext('2d'), gb = b.getContext('2d');
    const m = ctx.getTransform();
    for (const g of [
        ga,
        gb
    ]){
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, w, h);
        g.setTransform(m);
    }
    ga.globalAlpha = ctx.globalAlpha;
    sprite(ga);
    shapes(gb);
    ga.setTransform(1, 0, 0, 1, 0, 0);
    ga.globalAlpha = 1;
    ga.globalCompositeOperation = inside ? 'destination-in' : 'destination-out';
    ga.drawImage(b, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0);
    ctx.restore();
}
function sortItems(items) {
    items.sort((p, q)=>p.layer - q.layer || p.order - q.order || q.y - p.y || p.seq - q.seq);
}
function rigItems(rig, tex, tintAll, skip, customDraw, nested) {
    const { nodes, world, data } = rig;
    const groupOf = new Array(nodes.length);
    const isGroup = (i)=>!!nodes[i].sg;
    for(let i = 0; i < nodes.length; i++){
        let k = nodes[i].p;
        while(k >= 0 && !isGroup(k))k = nodes[k].p;
        groupOf[i] = k;
    }
    const members = new Map();
    for(let i = 0; i < nodes.length; i++){
        if (skip?.(i)) continue;
        const nd = nodes[i];
        const renders = nd.s && !(nd.live?.srOff ?? nd.srOff) || nd.skinned || customDraw?.has(i);
        if (isGroup(i)) {
            const parentGroup = groupOf[i];
            const list = members.get(parentGroup) ?? [];
            list.push(-(i + 1));
            members.set(parentGroup, list);
            if (renders) {
                const own = members.get(i) ?? [];
                own.push(i);
                members.set(i, own);
            }
        } else if (renders) {
            const list = members.get(groupOf[i]) ?? [];
            list.push(i);
            members.set(groupOf[i], list);
        }
    }
    const tint = (c)=>{
        const base = c ?? [
            1,
            1,
            1,
            1
        ];
        if (!tintAll) return base;
        return [
            base[0] * tintAll[0],
            base[1] * tintAll[1],
            base[2] * tintAll[2],
            base[3] * tintAll[3]
        ];
    };
    const masks = nodes.map((n, i)=>n.isMask && n.maskSprite ? i : -1).filter((i)=>i >= 0);
    const drawNode = (ctx, i)=>{
        if (!rig.isVisible(i)) return;
        const nd = nodes[i];
        const cd = customDraw?.get(i);
        if (cd) {
            cd(ctx, world[i]);
            return;
        }
        if (nd.skinned) {
            drawSkinned(ctx, rig, nd.skinned, tex, tint(undefined));
            return;
        }
        if (nd.s) {
            let c = tint(nd.live?.c ?? nd.c);
            if (nd.alpha !== undefined && !nd.live?.c) c = [
                c[0],
                c[1],
                c[2],
                c[3] * nd.alpha
            ];
            const fx = nd.live?.fx ?? !!nd.fx, fy = nd.live?.fy ?? !!nd.fy;
            const dm = nd.draw;
            const size = rig.sized && dm ? nd.live?.size ?? [
                dm.w,
                dm.h
            ] : undefined;
            const live = nd.mask ? masks.filter((m)=>rig.isVisible(m)) : [];
            if (nd.mask === 1 || nd.mask === 2) {
                drawMasked(ctx, nd.mask === 1, (g)=>drawSprite(g, data, tex, nd.s, world[i], c, fx, fy, size), (g)=>{
                    for (const m of live)drawSprite(g, data, tex, nodes[m].maskSprite, world[m]);
                });
            } else drawSprite(ctx, data, tex, nd.s, world[i], c, fx, fy, size);
        }
    };
    const keyOf = (entry)=>{
        const i = entry < 0 ? -entry - 1 : entry;
        const nd = nodes[i];
        if (entry < 0) return {
            layer: layerIndex(data, nd.sg[0]),
            order: nd.sg[1],
            i
        };
        if (nd.skinned && !nd.s) return {
            layer: layerIndex(data, nd.skinned.l),
            order: nd.skinned.o,
            i
        };
        return {
            layer: layerIndex(data, nd.l),
            order: nd.live?.o ?? nd.o ?? 0,
            i
        };
    };
    let nestedGroup = -2;
    if (nested) {
        let k = nested.parent;
        while(k >= 0 && !isGroup(k))k = nodes[k].p;
        nestedGroup = k;
    }
    const drawGroup = (ctx, g)=>{
        if (!rig.isVisible(g)) return;
        const list = (members.get(g) ?? []).map(keyOf);
        if (nested && g === nestedGroup) list.push({
            layer: layerIndex(data, nested.layer),
            order: nested.order,
            i: nodes.length
        });
        list.sort((p, q)=>p.layer - q.layer || p.order - q.order || p.i - q.i);
        for (const e of list){
            if (e.i === nodes.length) nested.draw(ctx);
            else if (nodes[e.i].sg && e.i !== g) drawGroup(ctx, e.i);
            else drawNode(ctx, e.i);
        }
    };
    const out = [];
    for (const entry of members.get(-1) ?? []){
        const k = keyOf(entry);
        const i = k.i;
        out.push({
            layer: k.layer,
            order: k.order,
            y: world[i]?.[5] ?? 0,
            seq: i,
            draw: entry < 0 ? (ctx)=>drawGroup(ctx, i) : (ctx)=>drawNode(ctx, i)
        });
    }
    return out;
}

return {RigInstance, drawSprite, rigItems, sortItems, IDENTITY, mul, trs};
})();
// TEST WORLD adapter: visual presentation only. Combat state is never mutated here.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const ITEM_TYPES = {Helmet: 0, Armour: 1, Gloves: 2, Necklace: 3, Ring: 4, Weapon: 5, Shoes: 6, Belt: 7};

function forAscension(list, level) {
    if (!list || !list.length) return null;
    const top = Math.min(Math.max(0, Math.floor(finite(level))), list.length - 1);
    for (let i = top; i >= 0; i--) if (list[i] != null) return list[i];
    for (let i = top + 1; i < list.length; i++) if (list[i] != null) return list[i];
    return null;
}

class LocalTextures {
    constructor(base, sizes) {
        this.base = String(base || './assets/releases/live_2_12_1').replace(/\/$/, '');
        this.sizes = sizes || {};
        this.images = new Map();
        this.pending = new Map();
        this.failed = new Set();
        this.closed = false;
    }
    get(name) {
        if (!name || this.closed) return null;
        if (this.images.has(name)) return this.images.get(name);
        if (this.pending.has(name) || this.failed.has(name)) return null;
        const image = new Image();
        image.decoding = 'async';
        this.pending.set(name, new Promise(resolve => {
            image.onload = () => {
                const expected = this.sizes[name];
                if (expected && (expected.w !== image.naturalWidth || expected.h !== image.naturalHeight)) {
                    this.failed.add(name);
                } else if (!this.closed) this.images.set(name, image);
                this.pending.delete(name);
                resolve();
            };
            image.onerror = () => { this.failed.add(name); this.pending.delete(name); resolve(); };
            image.src = `${this.base}/${encodeURIComponent(name)}.png`;
        }));
        return null;
    }
    ready() { return Promise.allSettled([...this.pending.values()]); }
    destroy() { this.closed = true; this.images.clear(); }
}

function create(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required');
    const data = options.visuals;
    if (!data?.prefabs?.UnitView || !data.sprites) throw new TypeError('BattleVisuals.json is required');
    const catalog = options.catalog?.gameData || options.catalog || {};
    const configs = options.configs || options.catalog?.configs || {};
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    const textures = new LocalTextures(options.assetBase || catalog.assetPath, data.textures);
    const itemByKey = new Map((catalog.equipment || []).flatMap(row => [[row.key, row], [`${row.Age}:${row.TypeName}:${row.Idx}`, row]]));
    const petByKey = new Map((catalog.pets || []).map(row => [row.key, row]));
    const mountByKey = new Map((catalog.mounts || []).map(row => [row.key, row]));
    const skinByKey = new Map((catalog.skins || []).flatMap(row => [[row.key, row], [`${row.type}:${row.id}`, row]]));
    const actors = new Map(), maps = new Map(), effects = new Map(), missingPrefabs = new Set();
    const clipCache = new Map();
    let lastBattle = null, closed = false, frameCount = 0;
    let width = 1200, height = 620, dpr = 1;
    let camera = {scale: 75, x: 5, y: 409, left: 225};

    function controllerClips(name, seen = new Set()) {
        if (!name || seen.has(name)) return {};
        if (clipCache.has(name)) return clipCache.get(name);
        seen.add(name);
        const controller = data.controllers[name];
        const clips = {...controllerClips(controller?.base, seen), ...(controller?.clips || {})};
        clipCache.set(name, clips);
        return clips;
    }
    function preload(rig) {
        for (const node of rig.nodes) {
            for (const key of [node.s, node.maskSprite]) if (data.sprites[key]) textures.get(data.sprites[key].tex);
            if (node.skinned?.tex) textures.get(node.skinned.tex);
        }
    }
    function prefab(name) {
        if (!name || !data.prefabs[name]) { if (name) missingPrefabs.add(name); return null; }
        const rig = new Rig.RigInstance(data, name);
        rig.sized = true;
        rig.autonomous = rig.nodes.map((node, index) => ({index, controller: node.anim})).filter(row => row.controller);
        preload(rig);
        return rig;
    }
    function autonomous(rig, time) {
        for (const animation of rig.autonomous || []) {
            const clips = controllerClips(animation.controller);
            const name = Object.values(clips)[0];
            if (!name) continue;
            rig.setAnimRoot(animation.index);
            rig.applyClip(data.clips[name], time, true, true);
        }
    }
    function equipmentVisual(selection, slot) {
        if (!selection) return slot === 'Weapon' ? data.visuals[data.defaultWeapon] : null;
        const item = selection.key ? itemByKey.get(selection.key) || selection : selection;
        const id = item.definition?.ItemId || item.ItemId || item;
        const age = finite(id.Age ?? id.age, 10000), index = finite(id.Idx ?? id.idx);
        if (age === 10000) return data.visuals[data.defaultWeapon];
        const name = data.ages[age]?.items[String(ITEM_TYPES[slot])]?.[index];
        return data.visuals[name] || (slot === 'Weapon' ? data.visuals[data.defaultWeapon] : null);
    }
    function selectedSkin(selection, slot, ranged) {
        if (!selection || selection.visible === false) return null;
        const key = typeof selection === 'string' ? selection : selection.key;
        const row = skinByKey.get(key);
        const id = row?.id ?? selection.id ?? selection.idx ?? finite(String(key || '').split(/[_:]/).pop(), -1);
        const skin = data.skins.find(value => value.itemType === ITEM_TYPES[slot] && value.skinVisualId === id);
        const name = ranged && skin?.secondary ? skin.secondary : skin?.main;
        return data.visuals[name] || null;
    }
    function companion(selection, kind, ascension) {
        if (!selection) return null;
        const key = typeof selection === 'string' ? selection : selection.key;
        const row = (kind === 'pets' ? petByKey : mountByKey).get(key);
        const id = row?.definition?.[kind === 'pets' ? 'PetId' : 'MountId'];
        const parts = String(key || '').split(/[_:]/);
        const rarity = id?.Rarity || row?.rarity || selection.rarity || parts[0];
        const index = id?.Id ?? selection.id ?? finite(parts[1]);
        const definition = data[kind]?.[rarity]?.[index];
        return forAscension(definition?.prefabs, ascension);
    }
    function lookFor(unit, state, player) {
        if (!player) {
            const enemy = configs.EnemyLibrary?.[unit.configId] || {};
            return {helmet: equipmentVisual(enemy.HelmetId, 'Helmet'), armour: equipmentVisual(enemy.ArmourId, 'Armour'),
                weapon: equipmentVisual(unit.weaponId || enemy.WeaponId, 'Weapon'), pets: [], mount: null};
        }
        const equipment = state.equipment || {}, skins = state.skins || {};
        return {
            helmet: selectedSkin(skins.Helmet, 'Helmet', false) || equipmentVisual(equipment.Helmet, 'Helmet'),
            armour: selectedSkin(skins.Armour, 'Armour', false) || equipmentVisual(equipment.Armour, 'Armour'),
            weapon: selectedSkin(skins.Weapon, 'Weapon', !!unit.stats?.ranged) || equipmentVisual(equipment.Weapon, 'Weapon'),
            mount: companion(state.mount, 'mounts', state.mountAsc),
            pets: (state.pets || []).slice(0, 3).map(selection => companion(selection, 'pets', state.petAsc)).filter(Boolean)
        };
    }
    function buildActor(look, player) {
        const rig = prefab('UnitView');
        const head = rig.find('Head'), body = rig.find('Body'), charRig = rig.find('CharacterRig');
        const wp = rig.find('[SCALE] Weapon-Primary'), ws = rig.find('[SCALE] Weapon-Secondary');
        const parts = rig.nodes[charRig]?.bodyPartNodes || [head, body, rig.find('[ROT] Hand-Secondary'), rig.find('[ROT] Hand-Primary')];
        const byPart = {0: [parts[0]], 1: [parts[1]], 2: [parts[2], parts[3]]};
        const helmetRoot = look.helmet?.prefab ? rig.append(look.helmet.prefab, head) : -1;
        if (look.armour?.prefab) rig.append(look.armour.prefab, body);
        if (look.weapon?.prefab) {
            rig.append(look.weapon.prefab, wp);
            if (look.weapon.dualWield) rig.append(look.weapon.prefab, ws);
        }
        if (look.weapon?.hasSecondary && look.weapon.secondary) rig.append(look.weapon.secondary, ws);
        if (!player && rig.nodes[body]) rig.nodes[body].c = [0.35, 0.46, 0.63, 1];
        for (const [visual, base] of [[look.helmet, head], [look.armour, body], [look.weapon, -1]]) {
            if (visual?.hideBodyPart && base >= 0) rig.nodes[base].srOff = 1;
            for (const part of visual?.turnOff || []) for (const index of byPart[part] || []) if (rig.nodes[index]) rig.nodes[index].srOff = 1;
            for (const [part, color] of visual?.partColor || []) for (const index of byPart[part] || []) if (rig.nodes[index]) rig.nodes[index].c = color;
        }
        const hpParent = rig.find('HpBarParent');
        const hpOffset = rig.nodes[helmetRoot]?.mb?.HelmetEquipmentItem?.HpBarOffset;
        if (hpParent >= 0 && Number.isFinite(hpOffset)) {
            rig.nodes[hpParent].base.y = hpOffset;
            rig.nodes[hpParent].m = [...rig.nodes[hpParent].m.slice(0, 5), hpOffset];
        }
        const bar = rig.find('HpBar');
        if (bar >= 0) rig.nodes[bar].hidden = true;
        const mount = prefab(look.mount), shadow = rig.find('Shadow');
        if (mount && shadow >= 0) rig.nodes[shadow].hidden = true;
        const mountAnchor = mount ? (mount.nodes[0].anchorNode ?? mount.find('UnitOffset')) : -1;
        const pets = look.pets.map((name, index) => {
            const pet = prefab(name);
            const offset = pet?.nodes[0].mb?.PetVisual?.PetOffsets?.[index];
            return {rig: pet, slot: index, offset: offset || {x: index === 1 ? -2.2 : -1.5, y: index === 0 ? -1.1 : index === 2 ? 1.1 : 0}};
        }).filter(value => value.rig);
        rig.autonomous = rig.nodes.map((node, index) => ({index, controller: node.anim})).filter(value => value.controller);
        preload(rig);
        return {rig, charRig, hpParent, mount, mountAnchor, pets, look,
            clips: controllerClips(look.weapon?.controller), attackCount: 0, attackAt: -100,
            lastX: NaN, lastY: NaN, moving: false, deathAt: null, player};
    }
    function actorFor(unit, state, player) {
        const look = lookFor(unit, state, player), signature = JSON.stringify(look);
        let actor = actors.get(unit.id);
        if (!actor || actor.signature !== signature) {
            actor = buildActor(look, player);
            actor.signature = signature;
            actors.set(unit.id, actor);
        }
        return actor;
    }
    function animatedActor(actor, unit, time, elapsed) {
        const {rig, mount} = actor, sign = unit.facing < 0 ? -1 : 1;
        if (unit.attackCount > actor.attackCount) { actor.attackAt = elapsed; actor.attackCount = unit.attackCount; }
        if (Number.isFinite(actor.lastX)) actor.moving = Math.hypot(unit.x - actor.lastX, unit.y - actor.lastY) > 0.0003;
        actor.lastX = unit.x; actor.lastY = unit.y;
        if (!unit.alive && actor.deathAt === null) actor.deathAt = elapsed;
        if (unit.alive) actor.deathAt = null;
        const deathAge = actor.deathAt === null ? 0 : elapsed - actor.deathAt;
        const fade = unit.alive ? 1 : clamp(1 - deathAge / 0.85, 0, 1);
        const tilt = unit.alive ? 0 : -Math.min(80, deathAge * 150) * sign;
        const hop = actor.moving && unit.alive ? Math.abs(Math.sin(time * 11)) * 0.065 : Math.sin(time * 2.6) * 0.012;
        const root = Rig.trs(finite(unit.x), finite(unit.y), tilt, sign, 1);
        rig.clearAnimation(); rig.parentWorld.clear();
        autonomous(rig, time);
        rig.setAnimRoot(actor.charRig);
        const attackClip = data.clips[actor.clips.Attack];
        const age = elapsed - actor.attackAt;
        if (attackClip && age >= 0 && age < Math.min(0.55, attackClip.length * 0.55)) {
            rig.applyClip(attackClip, Math.min(attackClip.length, attackClip.length * 0.48 + age), false, true);
        } else rig.applyClip(data.clips[actor.clips.Walk], time, true, true);
        const spine = rig.find('Spine');
        if (spine >= 0) rig.setLocalPosition(spine, rig.nodes[spine].base.x, rig.nodes[spine].base.y + hop);
        if (mount) {
            mount.clearAnimation(); autonomous(mount, time); mount.update(root);
            if (actor.mountAnchor >= 0) rig.parentWorld.set(actor.charRig, mount.world[actor.mountAnchor]);
        }
        rig.update(root);
        const tint = unit.flash > 0 ? [1, 0.78, 0.73, fade] : [1, 1, 1, fade];
        const riderItems = Rig.rigItems(rig, textures, tint);
        Rig.sortItems(riderItems);
        let mountItems = mount ? Rig.rigItems(mount, textures, [1, 1, 1, fade]) : [];
        Rig.sortItems(mountItems);
        const draw = context => {
            for (const item of mountItems) item.draw(context);
            for (const item of riderItems) item.draw(context);
        };
        const items = fade > 0 ? [{layer: 1, order: 0, y: finite(unit.y), seq: actor.player ? 1 : 2, draw}] : [];
        for (const pet of actor.pets) {
            const petX = unit.x + pet.offset.x * sign, petY = unit.y + pet.offset.y;
            pet.rig.clearAnimation(); autonomous(pet.rig, time + pet.slot * 0.7);
            const bounce = actor.moving ? Math.abs(Math.sin(time * 8 + pet.slot)) * 0.09 : 0;
            pet.rig.update(Rig.trs(petX, petY + bounce, 0, sign, 1));
            const list = Rig.rigItems(pet.rig, textures, [1, 1, 1, fade]);
            Rig.sortItems(list);
            if (fade > 0) items.push({layer: 1, order: 0, y: petY, seq: 10 + pet.slot,
                draw: context => { for (const item of list) item.draw(context); }});
        }
        return items;
    }
    function sizeCanvas(units, state) {
        const bounds = canvas.getBoundingClientRect();
        width = Math.max(1, bounds.width || canvas.clientWidth || canvas.width || 1200);
        height = Math.max(1, bounds.height || canvas.clientHeight || canvas.height || 620);
        dpr = clamp(finite(global.devicePixelRatio, 1), 1, 2);
        const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
        if (canvas.width !== pw) canvas.width = pw;
        if (canvas.height !== ph) canvas.height = ph;
        const alive = units.filter(unit => unit.alive !== false);
        const positions = alive.length ? alive : units;
        let minX = Math.min(...positions.map(unit => finite(unit.x)), 1), maxX = Math.max(...positions.map(unit => finite(unit.x)), 8);
        if ((state.pets || []).some(Boolean)) minX = Math.min(minX, finite(units[0]?.x, 1) - 2.5);
        const span = Math.max(13.5, maxX - minX + 4.2);
        const scale = Math.min(width / span, height / 8.2);
        const center = (minX + maxX) / 2;
        camera = {scale, x: center, y: height * 0.67, left: width / 2 - center * scale};
    }
    function worldContext() { ctx.setTransform(dpr * camera.scale, 0, 0, -dpr * camera.scale, dpr * camera.left, dpr * camera.y); }
    function screenContext() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function project(x, y) { return {x: camera.left + x * camera.scale, y: camera.y - y * camera.scale}; }
    function mapItems(state, time) {
        const age = data.ages[clamp(Math.floor(finite(state.stage?.age)), 0, data.ages.length - 1)] || data.ages[0];
        const name = age.maps[Math.abs(Math.floor(finite(state.stage?.battle))) % age.maps.length];
        let rig = maps.get(name);
        if (!rig) { rig = prefab(name); if (rig) maps.set(name, rig); }
        if (!rig) return [];
        rig.clearAnimation(); autonomous(rig, time); rig.update(Rig.IDENTITY);
        return Rig.rigItems(rig, textures);
    }
    function effectItems(battle, state, elapsed) {
        const result = [], used = new Set();
        for (const event of battle.events || []) {
            if (event.type !== 'skill') continue;
            const age = elapsed - event.time;
            if (age < 0 || age > 2.1) continue;
            const definition = data.skills[String(data.skillIds[event.skillId])];
            const name = forAscension(definition?.animations, state.skillAsc);
            if (!name) continue;
            const key = `${event.id}:${name}`;
            used.add(key);
            let effect = effects.get(key);
            if (!effect) { effect = prefab(name); if (effect) effects.set(key, effect); }
            if (!effect) continue;
            const target = (battle.enemies || []).find(unit => unit.alive) || battle.player;
            const buff = ['Meat', 'Morale', 'Berserk', 'Thorns', 'Buff', 'HigherMorale', 'InfiniteRenewal'].includes(event.skillId);
            const unit = buff ? battle.player : target;
            effect.clearAnimation(); autonomous(effect, age);
            effect.update(Rig.trs(finite(unit?.x, event.x), finite(unit?.y, event.y), 0, 1, 1));
            const alpha = clamp((2.1 - age) / 0.3, 0, 1);
            for (const item of Rig.rigItems(effect, textures, [1, 1, 1, alpha])) {
                item.layer = Math.max(2, item.layer); result.push(item);
            }
        }
        for (const key of effects.keys()) if (!used.has(key)) effects.delete(key);
        return result;
    }
    function compact(value) {
        value = finite(value);
        const abs = Math.abs(value);
        for (const [cut, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (abs >= cut) return `${(value / cut).toFixed(abs >= cut * 10 ? 0 : 1)}${suffix}`;
        return String(Math.round(value));
    }
    function healthBar(unit, actor) {
        if (unit.alive === false || !actor) return;
        const anchor = actor.rig.world[actor.hpParent];
        const at = anchor ? project(anchor[4], anchor[5]) : project(unit.x, unit.y + 1.8);
        const w = clamp(camera.scale * 1.18, 46, 100), h = width < 520 ? 6 : 8;
        const left = clamp(at.x - w / 2, 6, width - w - 6), top = Math.max(24, at.y - 10);
        const ratio = clamp(finite(unit.hp) / Math.max(1, finite(unit.maxHp, 1)), 0, 1);
        ctx.fillStyle = 'rgba(10,24,29,.88)'; ctx.beginPath(); ctx.roundRect(left - 2, top - 2, w + 4, h + 4, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(left, top, w, h);
        ctx.fillStyle = actor.player ? '#8bf2b0' : '#ff8290'; ctx.fillRect(left, top, w * ratio, h);
        if (unit.shield > 0) { ctx.fillStyle = '#8bd5ff'; ctx.fillRect(left, top + h + 3, w * clamp(unit.shield / Math.max(1, unit.maxHp), 0, 1), 3); }
        ctx.font = `700 ${width < 520 ? 9 : 11}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,22,28,.8)'; ctx.fillStyle = '#fff';
        const label = `${compact(unit.hp)} / ${compact(unit.maxHp)}`;
        ctx.strokeText(label, left + w / 2, top - 5); ctx.fillText(label, left + w / 2, top - 5);
    }
    function eventOverlay(battle, elapsed) {
        const unitById = new Map([battle.player, ...(battle.enemies || [])].filter(Boolean).map(unit => [unit.id, unit]));
        for (const event of (battle.events || []).slice(-32)) {
            const age = elapsed - finite(event.time);
            if (age < 0 || age > 1.1 || !['hit', 'heal', 'skill', 'death'].includes(event.type)) continue;
            const target = unitById.get(event.targetId);
            const x = finite(event.x, target?.x), y = finite(event.y, target?.y);
            const at = project(x, y + 1.25 + age * 0.9);
            ctx.save(); ctx.globalAlpha = clamp((1.1 - age) / 0.35, 0, 1);
            if (event.type === 'hit' && age < 0.18) {
                const p = project(x, y + 0.6);
                ctx.strokeStyle = event.critical ? '#ffe9a0' : '#fff3db';
                ctx.lineWidth = width < 520 ? 3 : 5;
                ctx.beginPath(); ctx.arc(p.x, p.y, camera.scale * 0.5, -0.8, 0.7); ctx.stroke();
            }
            if (event.type === 'hit' || event.type === 'heal') {
                const fontSize = (event.critical ? 25 : 20) * (width < 520 ? 0.7 : 1);
                ctx.font = `900 ${fontSize}px system-ui, sans-serif`; ctx.textAlign = 'center';
                ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(23,28,35,.92)';
                ctx.fillStyle = event.type === 'heal' ? '#a6ffd0' : event.critical ? '#ffe080' : '#ffffff';
                const label = event.blocked ? 'BLOCK' : `${event.type === 'heal' ? '+' : ''}${compact(event.amount)}`;
                ctx.strokeText(label, at.x + Math.sin(event.id * 2.1) * 13, at.y);
                ctx.fillText(label, at.x + Math.sin(event.id * 2.1) * 13, at.y);
            }
            ctx.restore();
        }
    }
    function render(battle, buildState = {}, timeSeconds = 0) {
        if (closed) return;
        if (!battle?.player) battle = {player: {id: 'player', x: 1, y: 0, hp: 100, maxHp: 100, alive: true, stats: {}, facing: 1}, enemies: [], events: [], elapsed: 0, status: 'preview'};
        if (lastBattle !== battle) { actors.clear(); effects.clear(); lastBattle = battle; }
        const units = [battle.player, ...(battle.enemies || [])], time = finite(timeSeconds), elapsed = finite(battle.elapsed);
        sizeCanvas(units, buildState);
        const age = data.ages[clamp(Math.floor(finite(buildState.stage?.age)), 0, data.ages.length - 1)] || data.ages[0];
        screenContext(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgb(${age.ground.slice(0, 3).map(c => Math.round(c * 255)).join(',')})`; ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        const drawItems = mapItems(buildState, time);
        for (const unit of units) {
            const actor = actorFor(unit, buildState, unit === battle.player);
            drawItems.push(...animatedActor(actor, unit, time, elapsed));
        }
        drawItems.push(...effectItems(battle, buildState, elapsed));
        Rig.sortItems(drawItems); worldContext();
        for (const item of drawItems) item.draw(ctx);
        screenContext();
        const shade = ctx.createLinearGradient(0, 0, 0, height);
        shade.addColorStop(0, 'rgba(6,26,33,.28)'); shade.addColorStop(.24, 'rgba(6,26,33,0)');
        shade.addColorStop(.78, 'rgba(6,26,33,0)'); shade.addColorStop(1, 'rgba(6,26,33,.23)');
        ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
        for (const unit of units) healthBar(unit, actors.get(unit.id));
        eventOverlay(battle, elapsed);
        frameCount++;
    }
    function diagnostics() {
        return {frames: frameCount, loadedTextures: textures.images.size, loadingTextures: textures.pending.size,
            failedTextures: [...textures.failed], missingPrefabs: [...missingPrefabs], actors: actors.size,
            viewport: {width, height, dpr}, camera: {...camera},
            playerLook: actors.get('player') ? JSON.parse(actors.get('player').signature) : null};
    }
    return {
        render,
        screenToWorld(x, y) { return {x: (x - camera.left) / camera.scale, y: (camera.y - y) / camera.scale}; },
        worldToScreen: project,
        whenReady: () => textures.ready(),
        getDiagnostics: diagnostics,
        destroy() { closed = true; textures.destroy(); actors.clear(); maps.clear(); effects.clear(); }
    };
}

global.FMRenderer = Object.freeze({create});
})(typeof window !== 'undefined' ? window : globalThis);

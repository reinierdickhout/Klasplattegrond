import { test } from "node:test";
import assert from "node:assert/strict";
import { standaardIndeling, draaiGroep, overlappendeIds, afmeting, bbox } from "../layout.ts";
import { splitsNaam, matchStudent, sorteerOpAchternaam } from "../names.ts";
import type { Tafel } from "../types.ts";

test("standaardindeling: 18 = 3 blokken van 2 breed x 3 diep", () => {
  const r = standaardIndeling(18);
  assert.equal(r.tafels.length, 18);
  assert.equal(r.blokken, 3);
  assert.equal(r.diepte, 3);
  assert.equal(overlappendeIds(r.tafels).size, 0);
});

test("standaardindeling: gangbare groottes hebben precies n tafels zonder overlap", () => {
  for (const n of [1, 2, 7, 18, 24, 25, 32, 48, 61]) {
    const r = standaardIndeling(n);
    assert.equal(r.tafels.length, n, `n=${n}`);
    assert.equal(overlappendeIds(r.tafels).size, 0, `overlap bij n=${n}`);
    for (const t of r.tafels) {
      const { w, h } = afmeting(t);
      assert.ok(t.x >= 0 && t.y >= 0 && t.x + w <= r.ruimte.breedte && t.y + h <= r.ruimte.hoogte, `buiten ruimte bij n=${n}`);
    }
  }
});

test("standaardindeling: 24 = 3x4, 32 = 4x4, 48 = 4x6", () => {
  assert.deepEqual([standaardIndeling(24).blokken, standaardIndeling(24).diepte], [3, 4]);
  assert.deepEqual([standaardIndeling(32).blokken, standaardIndeling(32).diepte], [4, 4]);
  assert.deepEqual([standaardIndeling(48).blokken, standaardIndeling(48).diepte], [4, 6]);
});

test("vier kwartslagen (beide kanten) brengen een tafel exact terug", () => {
  const t: Tafel = { id: "a", x: 5, y: 7, rot: 0 };
  const ruimte = { breedte: 40, hoogte: 40 };
  let cw = [t];
  let ccw = [t];
  for (let i = 0; i < 4; i++) {
    cw = draaiGroep(cw, 1, ruimte);
    ccw = draaiGroep(ccw, -1, ruimte);
  }
  assert.deepEqual(cw, [t]);
  assert.deepEqual(ccw, [t]);
  assert.equal(draaiGroep([t], 1, ruimte)[0].rot, 90);
  assert.equal(draaiGroep([t], -1, ruimte)[0].rot, 270);
});

test("groep draaien: vier kwartslagen keren exact terug en tafels blijven heel op het raster", () => {
  const { tafels } = standaardIndeling(18);
  const ruimte = { breedte: 80, hoogte: 80 };
  // midden in een grote ruimte, zodat de ruimte-clamp niet ingrijpt
  const midden = tafels.slice(0, 6).map((t) => ({ ...t, x: t.x + 20, y: t.y + 20 }));
  let g = midden;
  const start = JSON.stringify(g);
  for (let i = 0; i < 4; i++) g = draaiGroep(g, 1, ruimte);
  assert.equal(JSON.stringify(g), start);
  let ccw = midden;
  for (let i = 0; i < 4; i++) ccw = draaiGroep(ccw, -1, ruimte);
  assert.equal(JSON.stringify(ccw), start);
  const once = draaiGroep(midden, 1, ruimte);
  assert.ok(once.every((t) => Number.isInteger(t.x) && Number.isInteger(t.y)));
  assert.equal(overlappendeIds(once).size, 0);
});

test("namen splitsen en zoeken", () => {
  assert.deepEqual(splitsNaam("Anna de Vries"), { voornaam: "Anna", achternaam: "de Vries" });
  assert.deepEqual(splitsNaam("de Vries, Anna"), { voornaam: "Anna", achternaam: "de Vries" });
  assert.deepEqual(splitsNaam("Madonna"), { voornaam: "Madonna", achternaam: "" });
  const s = { id: "1", voornaam: "Zoë", achternaam: "van der Berg", nummer: "2012345" };
  assert.ok(matchStudent(s, "zoe berg"));
  assert.ok(matchStudent(s, "2012"));
  assert.ok(!matchStudent(s, "jan"));
});

test("groep groter dan het lokaal: nooit negatieve coordinaten (lokaal groeit rechts/onder mee)", () => {
  const { tafels, ruimte } = standaardIndeling(32);
  const voorsteRij = tafels.filter((x) => x.y === 5);
  assert.equal(voorsteRij.length, 8);
  for (const richting of [1, -1] as const) {
    const gedraaid = draaiGroep(voorsteRij, richting, ruimte);
    const b = bbox(gedraaid);
    assert.ok(b.x >= 0 && b.y >= 0, `negatief bij richting ${richting}: ${JSON.stringify(b)}`);
    assert.ok(gedraaid.every((x) => Number.isInteger(x.x) && Number.isInteger(x.y)));
  }
});

test("groep die in het lokaal past wordt binnen het lokaal gehouden", () => {
  const ruimte = { breedte: 30, hoogte: 30 };
  const bijna = [{ id: "a", x: 0, y: 0, rot: 0 as const }, { id: "b", x: 4, y: 0, rot: 0 as const }];
  const gedraaid = draaiGroep(bijna, -1, ruimte);
  const b = bbox(gedraaid);
  assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 30 && b.y + b.h <= 30, JSON.stringify(b));
});

test("sorteren op achternaam negeert tussenvoegsels (de Boer onder B)", () => {
  const mk = (voornaam: string, achternaam: string) => ({ id: voornaam, voornaam, achternaam });
  const gesorteerd = sorteerOpAchternaam([mk("Iris", "de Boer"), mk("Fleur", "Bakker"), mk("Zoe", "van der Meer"), mk("Ruben", "Bos"), mk("Yara", "El Amrani")]);
  assert.deepEqual(gesorteerd.map((s) => s.achternaam), ["Bakker", "de Boer", "Bos", "El Amrani", "van der Meer"]);
});

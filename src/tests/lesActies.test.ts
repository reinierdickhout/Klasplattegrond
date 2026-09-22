import { test } from "node:test";
import assert from "node:assert/strict";
import { plaats, zetStudentOpTafel, losStudent, sluitAanvang, berekenAanwezigheid, tel } from "../lesActies.ts";
import type { Klas, Les } from "../types.ts";

const basis = (): Les => ({
  id: "l", titel: "", datum: "2026-09-21", klasId: "k", capaciteit: 4, ruimte: { breedte: 20, hoogte: 20 },
  tafels: ["t1", "t2", "t3"].map((id, i) => ({ id, x: i * 4, y: 5, rot: 0 as const })),
  plaatsingen: [], status: "voorbereiding", aangemaakt: "2026-09-21T10:00:00Z",
});
const klas: Klas = {
  id: "k", naam: "K", bijgewerkt: "",
  studenten: ["a", "b", "c"].map((id) => ({ id, voornaam: id.toUpperCase(), achternaam: "X" })),
};

test("nieuwe student op lege tafel: bij aanvang, tot de aanvang is afgesloten", () => {
  let l = zetStudentOpTafel(basis(), "a", "t1", new Date("2026-09-21T10:01:00Z"));
  assert.equal(l.plaatsingen.length, 1);
  assert.equal(l.plaatsingen[0].laat, false);
  l = sluitAanvang(l, new Date("2026-09-21T10:05:00Z"));
  l = zetStudentOpTafel(l, "b", "t2", new Date("2026-09-21T10:07:00Z"));
  assert.equal(l.plaatsingen.find((p) => p.studentId === "b")?.laat, true);
});

test("nieuwe student op bezette tafel vervangt de eerdere student", () => {
  let l = zetStudentOpTafel(basis(), "a", "t1");
  l = zetStudentOpTafel(l, "b", "t1");
  assert.deepEqual(l.plaatsingen.map((p) => p.studentId), ["b"]);
});

test("verhuizen naar een vrije tafel behoudt tijdstip en 'later'-status", () => {
  let l = sluitAanvang(basis(), new Date("2026-09-21T10:05:00Z"));
  l = zetStudentOpTafel(l, "a", "t1", new Date("2026-09-21T10:09:00Z"));
  const voor = l.plaatsingen[0];
  assert.equal(voor.laat, true);
  l = zetStudentOpTafel(l, "a", "t3", new Date("2026-09-21T10:30:00Z"));
  assert.equal(l.plaatsingen.length, 1);
  assert.deepEqual({ ...l.plaatsingen[0] }, { ...voor, tafelId: "t3" });
});

test("slepen naar een bezette tafel wisselt de twee studenten (elk houdt eigen tijd/status)", () => {
  let l = zetStudentOpTafel(basis(), "a", "t1", new Date("2026-09-21T10:01:00Z"));
  l = sluitAanvang(l, new Date("2026-09-21T10:05:00Z"));
  l = zetStudentOpTafel(l, "b", "t2", new Date("2026-09-21T10:08:00Z"));
  l = zetStudentOpTafel(l, "a", "t2");
  const a = l.plaatsingen.find((p) => p.studentId === "a")!;
  const b = l.plaatsingen.find((p) => p.studentId === "b")!;
  assert.equal(a.tafelId, "t2");
  assert.equal(b.tafelId, "t1");
  assert.equal(a.laat, false);
  assert.equal(b.laat, true);
  assert.equal(l.plaatsingen.length, 2);
});

test("zelfde tafel is geen wijziging; losmaken verwijdert alleen die student", () => {
  const l = zetStudentOpTafel(zetStudentOpTafel(basis(), "a", "t1"), "b", "t2");
  assert.equal(zetStudentOpTafel(l, "a", "t1"), l);
  assert.deepEqual(losStudent(l, "a").plaatsingen.map((p) => p.studentId), ["b"]);
});

test("aanwezigheid: bij aanvang, later en afwezig", () => {
  let l = plaats(basis(), "t1", "a");
  l = sluitAanvang(l);
  l = plaats(l, "t2", "b");
  const t = tel(berekenAanwezigheid(l, klas));
  assert.deepEqual([t.aanvang, t.later, t.afwezig], [1, 1, 1]);
});

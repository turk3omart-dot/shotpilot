import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHeading, parseScreenplay } from "./screenplay-parser";
import { UploadRejectedError, detectScriptKind } from "./extract";

const script = readFileSync(new URL("../../../tests/fixtures/the-last-light.fountain", import.meta.url), "utf8");

describe("parseHeading", () => {
  it("parses numbered INT/EXT headings with time of day", () => {
    expect(parseHeading("12A EXT. AL-ULA DESERT ROAD - DAWN 12A")).toMatchObject({ number: "12A", heading: "EXT. AL-ULA DESERT ROAD - DAWN", intExt: "EXT", location: "AL-ULA DESERT ROAD", timeOfDay: "DAWN" });
    expect(parseHeading("INT./EXT. CAR - NIGHT")).toMatchObject({ intExt: "INT/EXT", location: "CAR", timeOfDay: "NIGHT" });
  });
  it("parses Arabic headings", () => {
    expect(parseHeading("3. خارجي - صحراء العلا - ليل")).toMatchObject({ number: "3", intExt: "EXT", timeOfDay: "NIGHT" });
  });
  it("does not treat action lines as headings", () => {
    expect(parseHeading("Interior designers argue in the hall.")).toBeNull();
    expect(parseHeading("EXTRA large coffee.")).toBeNull();
  });
});

describe("parseScreenplay", () => {
  const r = parseScreenplay(script);
  it("extracts every scene with line references", () => {
    expect(r.scenes.map((s) => s.number)).toEqual(["1", "2", "3", "4", "5"]);
    for (const s of r.scenes) expect(s.endLine).toBeGreaterThanOrEqual(s.startLine);
  });
  it("links one character entity across scenes and strips cue extensions", () => {
    const noura = r.characters.find((c) => c.name === "NOURA");
    expect(noura?.sceneCount).toBe(4);
    expect(r.characters.map((c) => c.name)).not.toContain("NOURA (V.O.)");
  });
  it("flags night exterior lighting and keyword elements with low confidence", () => {
    const s5 = r.scenes[4]!;
    expect(s5.elements.some((e) => e.name === "night exterior lighting")).toBe(true);
    const kw = r.scenes[0]!.elements.find((e) => e.category === "vehicle");
    expect(kw?.confidence).toBe("low");
    expect(kw?.source?.startLine).toBeGreaterThan(0);
  });
  it("warns when text has no scene headings", () => {
    expect(parseScreenplay("A woman finds a camera in the desert.").warnings[0]).toMatch(/No standard scene headings/);
  });
});

describe("upload validation", () => {
  it("rejects files whose signature does not match the extension", () => {
    expect(() => detectScriptKind("script.pdf", new TextEncoder().encode("not a pdf"))).toThrow(UploadRejectedError);
    expect(() => detectScriptKind("script.docx", new TextEncoder().encode("plain"))).toThrow(UploadRejectedError);
    expect(() => detectScriptKind("script.exe", new Uint8Array([1, 2]))).toThrow(/Unsupported/);
  });
  it("accepts UTF-8 fountain files", () => {
    expect(detectScriptKind("a.fountain", new TextEncoder().encode(script))).toBe("fountain");
  });
});

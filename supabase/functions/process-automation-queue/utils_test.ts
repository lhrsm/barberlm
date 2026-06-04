
import { formatBrazilDate, formatBrazilTime } from "../_shared/utils.ts";
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("formatBrazilDate uses America/Sao_Paulo", () => {
  // UTC: 2026-06-04 01:00:00 -> BR: 2026-06-03 22:00:00 (since it's -3h)
  const utcDate = "2026-06-04T01:00:00Z";
  const result = formatBrazilDate(utcDate);
  assertEquals(result, "03/06/2026");
});

Deno.test("formatBrazilTime uses America/Sao_Paulo", () => {
  // UTC: 2026-06-04 15:00:00 -> BR: 2026-06-04 12:00:00
  const utcDate = "2026-06-04T15:00:00Z";
  const result = formatBrazilTime(utcDate);
  assertEquals(result, "12:00");
});

Deno.test("formatBrazilDate and time for morning/evening shifts", () => {
  const morningUTC = "2026-06-04T11:00:00Z"; // 08:00 BR
  const eveningUTC = "2026-06-04T23:30:00Z"; // 20:30 BR
  
  assertEquals(formatBrazilTime(morningUTC), "08:00");
  assertEquals(formatBrazilTime(eveningUTC), "20:30");
  assertEquals(formatBrazilDate(eveningUTC), "04/06/2026");
});

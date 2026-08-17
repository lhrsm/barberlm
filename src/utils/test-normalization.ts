import { normalizeIdentifier } from "./auth-identifier";

export const testNormalize = () => {
  const cases = [
    { input: "test@example.com", expectedType: "email", expectedValue: "test@example.com" },
    { input: " 71981708086 ", expectedType: "phone", expectedValue: "5571981708086" },
    { input: "7199999999", expectedType: "phone", expectedValue: "557199999999" }, // No 9-prefix if length 10
  ];

  cases.forEach(c => {
    const result = normalizeIdentifier(c.input);
    if (result.type !== c.expectedType || result.value !== c.expectedValue) {
      throw new Error(`Normalization failed for ${c.input}: expected ${c.expectedType}/${c.expectedValue}, got ${result.type}/${result.value}`);
    }
  });
  console.log("All normalization tests passed!");
};

if (import.meta.main) {
  testNormalize();
}

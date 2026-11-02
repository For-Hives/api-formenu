"use strict";

const { describe, it, expect } = require("@jest/globals");
const { errors } = require("@strapi/utils");
const {
  hasPivot,
  assertNoPivot,
  relationIds,
} = require("../../src/utils/company-content");

describe("`__pivot` in a request body", () => {
  it("is found at any depth", () => {
    expect(hasPivot({ image: { id: 1, __pivot: { related_id: 2 } } })).toBe(true);
    expect(
      hasPivot({ category: { connect: [{ id: 1, __pivot: { dish_id: 2 } }] } })
    ).toBe(true);
    expect(
      hasPivot({ content: { home_image: [{ id: 1, __pivot: {} }] } })
    ).toBe(true);
  });

  it("is absent from what admin-formenu sends", () => {
    expect(
      hasPivot({
        name: "Plat",
        image: { id: 1, name: "a.png", url: "/uploads/a.png", formats: null },
        category: { id: 2, name: "Entrées" },
        company: { id: 3, name: "R" },
        ingredients: [{ id: 4 }, 5],
      })
    ).toBe(false);
    expect(hasPivot(null)).toBe(false);
    expect(hasPivot("__pivot")).toBe(false);
  });

  it("is refused with a ValidationError", () => {
    expect(() => assertNoPivot({ a: [{ __pivot: {} }] })).toThrow(
      errors.ValidationError
    );
    expect(() => assertNoPivot({ a: 1 })).not.toThrow();
  });

  it("makes relationIds refuse the value instead of returning the id only", () => {
    expect(() => relationIds({ id: 1, __pivot: { file_id: 9 } })).toThrow(
      errors.ValidationError
    );
    expect(() => relationIds({ set: [{ id: 1, __pivot: {} }] })).toThrow(
      errors.ValidationError
    );
    expect(relationIds([{ id: 1 }, 2, { connect: [3] }])).toEqual([1, 2, 3]);
  });
});

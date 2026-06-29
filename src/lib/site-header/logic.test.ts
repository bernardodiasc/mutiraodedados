import { describe, it, expect } from "vitest";
import { Building2, Compass } from "lucide-react";
import {
  computeDisplayName,
  computeInitial,
  isGroupActive,
  isLinkActive,
} from "./logic";
import type { NavGroup } from "@/lib/nav-groups";

describe("computeDisplayName", () => {
  it("usa display_name quando presente", () => {
    expect(
      computeDisplayName({ user_metadata: { display_name: "Ana" }, email: "x@y.z" } as never),
    ).toBe("Ana");
  });
  it("cai para full_name", () => {
    expect(
      computeDisplayName({ user_metadata: { full_name: "Ana Maria" }, email: "x@y.z" } as never),
    ).toBe("Ana Maria");
  });
  it("cai para prefixo do email", () => {
    expect(computeDisplayName({ user_metadata: {}, email: "joao@dom.br" } as never)).toBe("joao");
  });
  it("usa 'Conta' como último recurso", () => {
    expect(computeDisplayName(null)).toBe("Conta");
  });
});

describe("computeInitial", () => {
  it("retorna a primeira letra em maiúsculo", () => {
    expect(computeInitial("ana")).toBe("A");
  });
  it("'?' quando vazio", () => {
    expect(computeInitial("")).toBe("?");
  });
});

const group: NavGroup = {
  label: "Explorar",
  icon: Compass,
  links: [
    { to: "/orgaos", label: "Órgãos", icon: Building2 },
    { to: "/contratos", label: "Contratos", icon: Building2 },
  ],
};

describe("isGroupActive / isLinkActive", () => {
  it("isGroupActive bate com prefixo", () => {
    expect(isGroupActive(group, "/orgaos/123")).toBe(true);
    expect(isGroupActive(group, "/outra")).toBe(false);
  });
  it("isLinkActive bate com prefixo do `to`", () => {
    expect(isLinkActive({ to: "/orgaos" }, "/orgaos/123")).toBe(true);
    expect(isLinkActive({ to: "/orgaos" }, "/")).toBe(false);
  });
});
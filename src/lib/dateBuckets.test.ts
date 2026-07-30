import { describe, it, expect } from "vitest";
import { bucketByScheduledDate, groupByDateBucket } from "./dateBuckets";

function isoOffset(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("bucketByScheduledDate", () => {
  it("sem data vai pra sem_data", () => {
    expect(bucketByScheduledDate(null)).toBe("sem_data");
    expect(bucketByScheduledDate(undefined)).toBe("sem_data");
  });

  it("data passada vai pra atrasado", () => {
    expect(bucketByScheduledDate(isoOffset(-1))).toBe("atrasado");
  });

  it("hoje vai pra hoje", () => {
    expect(bucketByScheduledDate(isoOffset(0))).toBe("hoje");
  });

  it("amanhã vai pra amanha", () => {
    expect(bucketByScheduledDate(isoOffset(1))).toBe("amanha");
  });

  it("depois de amanhã vai pra depois", () => {
    expect(bucketByScheduledDate(isoOffset(5))).toBe("depois");
  });
});

describe("groupByDateBucket", () => {
  it("agrupa mantendo a ordem de inserção dentro de cada balde", () => {
    const items = [{ id: "a", date: isoOffset(0) }, { id: "b", date: null }, { id: "c", date: isoOffset(0) }];
    const groups = groupByDateBucket(items, (i) => i.date);
    expect(groups.get("hoje")?.map((i) => i.id)).toEqual(["a", "c"]);
    expect(groups.get("sem_data")?.map((i) => i.id)).toEqual(["b"]);
  });
});

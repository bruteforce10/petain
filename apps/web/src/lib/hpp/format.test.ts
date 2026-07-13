import { describe, test, expect } from "bun:test";
import {
  parseFormattedNumber,
  formatInputNumber,
  sanitizeNumberInput,
  formatPercent,
  calculateCostPerProduct,
} from "./format";

describe("parseFormattedNumber", () => {
  describe("format ribuan id-ID (titik sebagai pemisah ribuan)", () => {
    test("mem-parse ribuan satu titik: '85.000' menjadi 85000", () => {
      expect(parseFormattedNumber("85.000")).toBe(85000);
    });

    test("mem-parse jutaan dua titik: '3.000.000' menjadi 3000000", () => {
      expect(parseFormattedNumber("3.000.000")).toBe(3000000);
    });

    test("mem-parse '3.500.000' menjadi 3500000 (bukan 3.5)", () => {
      expect(parseFormattedNumber("3.500.000")).toBe(3500000);
    });

    test("mem-parse target penjualan '1.000' menjadi 1000 (bukan 1)", () => {
      expect(parseFormattedNumber("1.000")).toBe(1000);
    });

    test("mem-parse '600.000' menjadi 600000", () => {
      expect(parseFormattedNumber("600.000")).toBe(600000);
    });

    test("mem-parse '1.234.567' menjadi 1234567", () => {
      expect(parseFormattedNumber("1.234.567")).toBe(1234567);
    });

    test("mentolerir spasi di sekitar angka", () => {
      expect(parseFormattedNumber(" 85.000 ")).toBe(85000);
    });
  });

  describe("desimal koma id-ID", () => {
    test("mem-parse '0,5' menjadi 0.5", () => {
      expect(parseFormattedNumber("0,5")).toBe(0.5);
    });

    test("mem-parse '12,5' menjadi 12.5", () => {
      expect(parseFormattedNumber("12,5")).toBe(12.5);
    });

    test("mem-parse kombinasi ribuan + desimal '1.234,56' menjadi 1234.56", () => {
      expect(parseFormattedNumber("1.234,56")).toBe(1234.56);
    });

    test("mem-parse '1234,56' menjadi 1234.56", () => {
      expect(parseFormattedNumber("1234,56")).toBe(1234.56);
    });

    test("koma menggantung saat mengetik: '12,' menjadi 12", () => {
      expect(parseFormattedNumber("12,")).toBe(12);
    });
  });

  describe("titik desimal non-ribuan (mis. dari data AI)", () => {
    test("mem-parse '0.5' menjadi 0.5 (bukan pola ribuan)", () => {
      expect(parseFormattedNumber("0.5")).toBe(0.5);
    });

    test("mem-parse '12.34' menjadi 12.34 (grup 2 digit bukan ribuan)", () => {
      expect(parseFormattedNumber("12.34")).toBe(12.34);
    });

    test("mem-parse '1.2345' menjadi 1.2345 (grup 4 digit bukan ribuan)", () => {
      expect(parseFormattedNumber("1.2345")).toBe(1.2345);
    });

    test("awalan nol tidak pernah ribuan: '0.125' menjadi 0.125 (bukan 125)", () => {
      expect(parseFormattedNumber("0.125")).toBe(0.125);
    });

    test("'1.500' tetap ribuan id-ID = 1500", () => {
      expect(parseFormattedNumber("1.500")).toBe(1500);
    });

    test("multi-titik yang bukan pola ribuan dianggap salah ketik pemisah: '1.2.3' menjadi 123", () => {
      expect(parseFormattedNumber("1.2.3")).toBe(123);
    });
  });

  describe("angka mentah dan input tidak valid", () => {
    test("melewatkan number apa adanya: 85000 tetap 85000", () => {
      expect(parseFormattedNumber(85000)).toBe(85000);
    });

    test("melewatkan number desimal apa adanya: 0.5 tetap 0.5", () => {
      expect(parseFormattedNumber(0.5)).toBe(0.5);
    });

    test("mengembalikan 0 untuk NaN", () => {
      expect(parseFormattedNumber(NaN)).toBe(0);
    });

    test("mengembalikan 0 untuk Infinity", () => {
      expect(parseFormattedNumber(Infinity)).toBe(0);
    });

    test("mengembalikan 0 untuk string kosong", () => {
      expect(parseFormattedNumber("")).toBe(0);
    });

    test("mengembalikan 0 untuk null dan undefined", () => {
      expect(parseFormattedNumber(null)).toBe(0);
      expect(parseFormattedNumber(undefined)).toBe(0);
    });

    test("mengembalikan 0 untuk teks non-angka", () => {
      expect(parseFormattedNumber("abc")).toBe(0);
    });

    test("mem-parse string tanpa titik: '100' menjadi 100", () => {
      expect(parseFormattedNumber("100")).toBe(100);
    });
  });
});

describe("formatInputNumber", () => {
  test("memformat angka polos dengan pemisah ribuan id-ID", () => {
    expect(formatInputNumber("85000")).toBe("85.000");
  });

  test("idempoten terhadap string yang sudah terformat", () => {
    expect(formatInputNumber("85.000")).toBe("85.000");
  });

  test("round-trip jutaan tidak menggerus nilai", () => {
    expect(formatInputNumber("3.000.000")).toBe("3.000.000");
  });

  test("menerima number mentah", () => {
    expect(formatInputNumber(8700000)).toBe("8.700.000");
  });

  test("mempertahankan desimal koma", () => {
    expect(formatInputNumber("0,5")).toBe("0,5");
  });

  test("mengembalikan string kosong untuk nilai kosong atau nol", () => {
    expect(formatInputNumber("")).toBe("");
    expect(formatInputNumber(0)).toBe("");
  });
});

describe("sanitizeNumberInput", () => {
  test("memformat ketikan digit polos menjadi ribuan id-ID", () => {
    expect(sanitizeNumberInput("85000")).toBe("85.000");
  });

  test("mempertahankan input yang sudah terformat", () => {
    expect(sanitizeNumberInput("85.000")).toBe("85.000");
  });

  test("membuang karakter non-angka (mis. tempel 'Rp 85.000')", () => {
    expect(sanitizeNumberInput("Rp 85.000")).toBe("85.000");
  });

  test("mengembalikan string kosong untuk input tanpa digit", () => {
    expect(sanitizeNumberInput("abc")).toBe("");
    expect(sanitizeNumberInput("")).toBe("");
  });

  test("mengizinkan desimal koma", () => {
    expect(sanitizeNumberInput("0,5")).toBe("0,5");
  });

  test("mempertahankan koma menggantung agar user bisa lanjut mengetik desimal", () => {
    expect(sanitizeNumberInput("12,")).toBe("12,");
  });

  test("memformat bagian ribuan sambil mempertahankan desimal", () => {
    expect(sanitizeNumberInput("1234,56")).toBe("1.234,56");
  });

  test("menggabungkan koma berlebih ke satu desimal", () => {
    expect(sanitizeNumberInput("1,2,3")).toBe("1,23");
  });
});

describe("formatPercent", () => {
  test("membulatkan ke satu desimal dengan koma id-ID", () => {
    expect(formatPercent(23.0769)).toBe("23,1%");
  });

  test("persentase bulat tanpa desimal", () => {
    expect(formatPercent(55)).toBe("55%");
  });

  test("nilai negatif mikro di sekitar nol tidak menampilkan '-0%'", () => {
    expect(formatPercent(-0.03)).toBe("0%");
  });
});

describe("calculateCostPerProduct", () => {
  describe("satuan hitung (pcs/buah/lembar)", () => {
    test("cup plastik: beli 100 pcs seharga 85000, pakai 1 pcs = 850", () => {
      expect(calculateCostPerProduct(1, "pcs", 85000, 100, "pcs")).toBe(850);
    });

    test("tutup cup: beli 100 pcs seharga 25000, pakai 1 pcs = 250", () => {
      expect(calculateCostPerProduct(1, "pcs", 25000, 100, "pcs")).toBe(250);
    });

    test("sedotan: beli 200 pcs seharga 18000, pakai 1 pcs = 90", () => {
      expect(calculateCostPerProduct(1, "pcs", 18000, 200, "pcs")).toBe(90);
    });

    test("buah dan pcs kompatibel sebagai satuan hitung", () => {
      expect(calculateCostPerProduct(2, "buah", 50000, 100, "pcs")).toBe(1000);
    });
  });

  describe("satuan berat dan volume", () => {
    test("biji kopi: beli 1000 g seharga 85000, pakai 18 g = 1530", () => {
      expect(calculateCostPerProduct(18, "g", 85000, 1000, "g")).toBe(1530);
    });

    test("konversi kg ke g: beli 1 kg seharga 85000, pakai 18 g = 1530", () => {
      expect(calculateCostPerProduct(18, "g", 85000, 1, "kg")).toBe(1530);
    });

    test("konversi L ke ml: beli 1 L seharga 30000, pakai 105 ml = 3150", () => {
      expect(calculateCostPerProduct(105, "ml", 30000, 1, "L")).toBe(3150);
    });

    test("satuan tidak peka huruf besar-kecil", () => {
      expect(calculateCostPerProduct(18, "G", 85000, 1, "Kg")).toBe(1530);
    });
  });

  describe("validasi", () => {
    test("mengembalikan 0 jika satuan tidak kompatibel (pcs vs kg)", () => {
      expect(calculateCostPerProduct(1, "pcs", 10000, 1, "kg")).toBe(0);
    });

    test("mengembalikan 0 jika jumlah beli 0", () => {
      expect(calculateCostPerProduct(1, "pcs", 10000, 0, "pcs")).toBe(0);
    });

    test("mengembalikan 0 jika ada input kosong", () => {
      expect(calculateCostPerProduct(0, "pcs", 10000, 100, "pcs")).toBe(0);
      expect(calculateCostPerProduct(1, "", 10000, 100, "pcs")).toBe(0);
      expect(calculateCostPerProduct(1, "pcs", 0, 100, "pcs")).toBe(0);
    });
  });
});

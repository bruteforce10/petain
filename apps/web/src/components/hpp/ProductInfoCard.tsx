"use client";

import * as React from "react";
import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CalculationMode } from "@/lib/hpp/types";

export interface ProductImageState {
  base64: string;
  preview: string;
  mimeType: string;
  name: string;
}

export const EMPTY_PRODUCT_IMAGE: ProductImageState = {
  base64: "",
  preview: "",
  mimeType: "",
  name: "",
};

// Batas upload foto produk; selaras dengan MAX_IMAGE_BASE64_CHARS di api/hpp-ai.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

interface ProductInfoCardProps {
  productName: string;
  onProductNameChange: (value: string) => void;
  productCategory: string;
  onProductCategoryChange: (value: string) => void;
  calculationMode: CalculationMode;
  onCalculationModeChange: (value: CalculationMode) => void;
  batchSize: string;
  onBatchSizeChange: (value: string) => void;
  productImage: ProductImageState;
  onProductImageChange: (value: ProductImageState) => void;
  onImageError: (message: string) => void;
}

export function ProductInfoCard({
  productName,
  onProductNameChange,
  productCategory,
  onProductCategoryChange,
  calculationMode,
  onCalculationModeChange,
  batchSize,
  onBatchSizeChange,
  productImage,
  onProductImageChange,
  onImageError,
}: ProductInfoCardProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      onProductImageChange(EMPTY_PRODUCT_IMAGE);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onImageError("Ukuran gambar maksimal 4 MB. Pilih file yang lebih kecil.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const [, base64Data] = result.split(",");
        onProductImageChange({
          base64: base64Data || "",
          preview: result,
          mimeType: file.type || "image/png",
          name: file.name,
        });
      }
    };
    reader.onerror = () => onImageError("Gagal membaca file gambar. Coba lagi.");
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    onProductImageChange(EMPTY_PRODUCT_IMAGE);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Produk</CardTitle>
        <CardDescription>Masukkan detail produk yang akan dihitung</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product-name">Nama Produk</Label>
          <Input
            id="product-name"
            placeholder="Contoh: Kopi Susu Gula Aren"
            value={productName}
            onChange={(e) => onProductNameChange(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-category">Kategori Produk</Label>
            <Select
              id="product-category"
              value={productCategory}
              onChange={(e) => onProductCategoryChange(e.target.value)}
            >
              <option value="">Pilih Kategori</option>
              <option value="food & baverage">Makanan & Minuman</option>
              <option value="retail">Retail</option>
              <option value="other">Lainnya</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="calculation-mode">Mode Perhitungan HPP</Label>
            <Select
              id="calculation-mode"
              value={calculationMode}
              onChange={(e) => onCalculationModeChange(e.target.value as CalculationMode)}
            >
              <option value="perPcs">Per Pcs (Satuan)</option>
              <option value="perBatch">Per Resep (Batch)</option>
            </Select>
          </div>
        </div>

        {calculationMode === "perBatch" && (
          <div className="space-y-2">
            <Label htmlFor="batch-size">Jumlah Produk per Resep/Batch</Label>
            <Input
              id="batch-size"
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 10"
              value={batchSize}
              onChange={(e) => onBatchSizeChange(e.target.value.replace(/[^\d]/g, ""))}
            />
            <p className="text-xs text-muted-foreground">
              Masukkan jumlah produk yang dihasilkan dari 1 resep/batch
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="product-image">Gambar Produk (Opsional)</Label>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-muted-foreground/40 bg-muted">
              {productImage.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview data URL lokal, bukan aset remote
                <img
                  src={productImage.preview}
                  alt="Preview produk"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-xs text-muted-foreground">
                  <ImagePlus className="mb-1 size-6" />
                  <span>Belum ada</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                id="product-image"
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Pilih Gambar
                </Button>
                {productImage.preview && (
                  <Button type="button" variant="ghost" onClick={handleRemoveImage}>
                    <X className="size-4" />
                    Hapus
                  </Button>
                )}
              </div>
              {productImage.name && (
                <p className="text-xs text-muted-foreground">{productImage.name}</p>
              )}
              <p className="max-w-sm text-xs text-muted-foreground">
                Gambar membantu AI memberi saran komponen biaya yang lebih akurat.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

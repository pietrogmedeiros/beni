"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  escolherMascote,
  removerFotoDePerfil,
} from "@/server/actions/projects";
import { LADO_AVATAR, MASCOTES, urlDoMascote } from "@/lib/avatares";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { UserDTO } from "@/server/queries";

/**
 * Escolha do avatar: foto, mascote ou iniciais.
 *
 * Uma coisa de cada vez. Mandar foto apaga o mascote e vice-versa — guardar as
 * duas e valer só uma criaria estado invisível, do tipo que faz a pessoa
 * trocar de volta e encontrar uma imagem que achava ter substituído.
 */
export function AvatarCard({ user }: { user: UserDTO }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const temFoto = !!user.avatarFoto;
  const mascote = user.avatarMascot ?? null;

  async function enviar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem.");
      return;
    }
    setSubindo(true);
    try {
      const quadrada = await recortarQuadrado(file);
      const form = new FormData();
      form.append("file", quadrada);
      const r = await fetch(withBase("/api/avatar"), {
        method: "POST",
        body: form,
      });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: null }));
        throw new Error(error ?? "Não deu para enviar a foto.");
      }
      toast.success("Foto atualizada.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubindo(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} showTooltip={false} className="size-14 text-base" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={subindo}
            onClick={() => inputRef.current?.click()}
          >
            {subindo ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {temFoto ? "Trocar foto" : "Enviar foto"}
          </Button>

          {(temFoto || mascote) && (
            <Button
              variant="ghost"
              size="sm"
              disabled={salvando}
              onClick={() =>
                startSalvar(async () => {
                  if (temFoto) await removerFotoDePerfil();
                  else await escolherMascote(null);
                  router.refresh();
                })
              }
            >
              <Trash2 className="size-3.5" />
              Voltar às iniciais
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
          e.target.value = "";
        }}
      />

      <div className="space-y-1.5">
        <Label>Ou use um Beni</Label>
        <div className="flex flex-wrap gap-1.5">
          {MASCOTES.map((m) => (
            <button
              key={m.chave}
              type="button"
              aria-label={`Avatar ${m.chave}`}
              aria-pressed={mascote === m.chave}
              disabled={salvando}
              onClick={() =>
                startSalvar(async () => {
                  await escolherMascote(m.chave);
                  router.refresh();
                })
              }
              className={cn(
                "size-10 rounded-full bg-muted/60 p-0.5 ring-offset-2 ring-offset-background transition hover:bg-muted",
                mascote === m.chave && "ring-2 ring-foreground",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBase(urlDoMascote(m.chave))}
                alt=""
                className="size-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Recorta no centro e reduz antes de subir.
 *
 * O corte quadrado é feito aqui porque o avatar é sempre redondo: subir uma
 * foto retangular e deixar o CSS cortar guardaria bytes que nunca aparecem —
 * e eles moram dentro do banco.
 */
async function recortarQuadrado(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const lado = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = LADO_AVATAR;
  canvas.height = LADO_AVATAR;

  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - lado) / 2,
      (bitmap.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      LADO_AVATAR,
      LADO_AVATAR,
    );

  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/webp", 0.9),
  );
  if (!blob) throw new Error("Não deu para preparar a imagem.");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

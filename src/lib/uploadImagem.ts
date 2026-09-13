import { supabase } from "@/lib/supabase";

const BUCKET = "anexos-suporte";

function extensaoDe(nome: string): string {
  const match = nome.match(/\.([A-Za-z0-9]+)$/);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export async function uploadImagensSuporte(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];

  const urls: string[] = [];
  for (const arquivo of files) {
    const caminho = `${crypto.randomUUID()}${extensaoDe(arquivo.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`/suporte/${caminho}`, arquivo, {
        upsert: false,
        contentType: arquivo.type,
      });

    if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`/suporte/${caminho}`);
    urls.push(data.publicUrl);
  }

  return urls;
}

export function montarMensagemComImagens(texto: string, urls: string[]): string {
  if (urls.length === 0) return texto;
  const imagem = urls.map(u => `[IMAGEM]\n${u}`).join("\n\n");
  return texto ? `${texto}\n\n${imagem}` : imagem;
}
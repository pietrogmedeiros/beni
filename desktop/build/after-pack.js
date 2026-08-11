const { execFileSync } = require("node:child_process");
const path = require("node:path");

/**
 * Assinatura ad-hoc do pacote, depois que o electron-builder monta o .app.
 *
 * Sem conta de desenvolvedor não há notarização, mas *alguma* assinatura é
 * obrigatória: em Apple Silicon o macOS recusa app sem assinatura nenhuma com
 * "está danificado e não pode ser aberto" — mensagem que parece corrupção de
 * download e manda o usuário embora.
 *
 * O `identity: "-"` do electron-builder não serve: ele procura uma identidade
 * com esse nome no chaveiro, não encontra e simplesmente pula a assinatura.
 * Aqui chamamos o `codesign` direto, que entende "-" como ad-hoc.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  // O build universal monta x64 e arm64 em pastas "-temp" e depois funde as
  // duas. Assinar as parciais faz a fusão falhar, porque o `_CodeSignature`
  // sai diferente em cada arquitetura e o `lipo` exige arquivos idênticos.
  // Só o pacote final é assinado.
  if (context.appOutDir.includes("-temp")) return;

  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", app],
    { stdio: "inherit" },
  );
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
    stdio: "inherit",
  });

  console.log(`  • assinado ad-hoc      ${app}`);
};

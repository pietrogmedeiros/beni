const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { rmSync } = require("node:fs");

/**
 * Notariza e grampeia o app depois de assinado.
 *
 * A notarização é o que faz o macOS abrir o app **baixado da internet** sem
 * aviso. Sem ela, o download carrega a marca de quarentena e o Gatekeeper
 * recusa — e desde as versões recentes do macOS nem o antigo "botão direito →
 * Abrir" resolve, o que na prática significa que quase ninguém consegue abrir.
 *
 * As credenciais vêm de um perfil no chaveiro (`notarytool store-credentials`),
 * nunca de variável ou de arquivo no repositório: a senha específica do app dá
 * acesso à conta de desenvolvedor.
 *
 * O `staple` grava o comprovante dentro do próprio pacote. Sem ele, o primeiro
 * uso depende de a máquina conseguir consultar a Apple — e quem abrir sem
 * internet toma o bloqueio mesmo com tudo certo.
 */
const PERFIL = process.env.BENI_NOTARY_PROFILE ?? "beni";

/**
 * Duas formas de provar quem somos para a Apple.
 *
 * O perfil do chaveiro é o caminho normal, e é o que funciona quando você
 * mesmo roda o build no seu terminal. Só que ler senha do chaveiro exige uma
 * sessão com ele destravado — um shell automatizado não tem isso, e o
 * `notarytool` responde que o perfil não existe, o que parece erro de
 * configuração e não é.
 *
 * Por isso o segundo caminho: apontar direto para a chave `.p8`. Mesmas
 * credenciais, sem depender do chaveiro.
 */
function credenciais() {
  const chave = process.env.BENI_NOTARY_KEY;
  if (chave) {
    return [
      "--key", chave,
      "--key-id", process.env.BENI_NOTARY_KEY_ID,
      "--issuer", process.env.BENI_NOTARY_ISSUER,
    ];
  }
  return ["--keychain-profile", PERFIL];
}

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.BENI_SKIP_NOTARIZE === "1") {
    console.log("  • notarização pulada (BENI_SKIP_NOTARIZE=1)");
    return;
  }

  const app = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  console.log(`  • notarizando ${app}`);
  const inicio = Date.now();

  // O notarytool não aceita um `.app` solto — só zip, pkg ou dmg. O `ditto`
  // com `--keepParent` é o empacotador que a Apple documenta: preserva os
  // links simbólicos e os atributos estendidos do pacote, que um `zip` comum
  // estraga e faz a assinatura deixar de bater.
  const zip = `${app}.zip`;
  execFileSync("ditto", ["-c", "-k", "--keepParent", app, zip], {
    stdio: "inherit",
  });

  try {
    execFileSync(
      "xcrun",
      ["notarytool", "submit", zip, ...credenciais(), "--wait"],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(zip, { force: true });
  }

  // o grampo vai no `.app`, não no zip: é o pacote que a pessoa abre
  execFileSync("xcrun", ["stapler", "staple", app], { stdio: "inherit" });

  console.log(
    `  • notarizado e grampeado em ${Math.round((Date.now() - inicio) / 1000)}s`,
  );
};

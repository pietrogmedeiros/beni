import "server-only";

const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function gh<T>(path: string, token: string | null): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "beni-app",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // dados do GitHub mudam com frequência; sempre buscar do servidor
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new GithubError(
      token
        ? "Não encontrado no GitHub (verifique o nome e as permissões do token)"
        : "Não encontrado. Se o repositório é privado, configure um token do GitHub em Configurações.",
      404,
    );
  }
  if (response.status === 401 || response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    throw new GithubError(
      remaining === "0"
        ? "Limite de requisições do GitHub atingido. Configure um token em Configurações."
        : "O GitHub recusou a credencial (token inválido ou sem permissão).",
      response.status,
    );
  }
  if (!response.ok) {
    throw new GithubError(`GitHub respondeu ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

/** Aceita `owner/repo`, `https://github.com/owner/repo` ou `git@github.com:owner/repo.git`. */
export function parseRepoInput(input: string) {
  const value = input.trim();

  const url = value.match(
    /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  if (url) return { owner: url[1], name: url[2] };

  const short = value.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (short) return { owner: short[1], name: short[2] };

  return null;
}

/** Extrai `{owner, name, number}` de uma URL de issue ou pull request. */
export function parseIssueInput(input: string) {
  const value = input.trim();

  const url = value.match(
    /github\.com\/([\w.-]+)\/([\w.-]+)\/(issues|pull)\/(\d+)/i,
  );
  if (url) {
    return { owner: url[1], name: url[2], number: Number(url[4]) };
  }

  const number = value.match(/^#?(\d+)$/);
  if (number) return { owner: null, name: null, number: Number(number[1]) };

  return null;
}

export type GithubRepoInfo = {
  owner: string;
  name: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  openIssues: number;
  stars: number;
  language: string | null;
  pushedAt: string | null;
};

export async function fetchRepo(
  owner: string,
  name: string,
  token: string | null,
): Promise<GithubRepoInfo> {
  const data = await gh<{
    name: string;
    owner: { login: string };
    html_url: string;
    description: string | null;
    default_branch: string;
    private: boolean;
    open_issues_count: number;
    stargazers_count: number;
    language: string | null;
    pushed_at: string | null;
  }>(`/repos/${owner}/${name}`, token);

  return {
    owner: data.owner.login,
    name: data.name,
    htmlUrl: data.html_url,
    description: data.description,
    defaultBranch: data.default_branch,
    isPrivate: data.private,
    openIssues: data.open_issues_count,
    stars: data.stargazers_count,
    language: data.language,
    pushedAt: data.pushed_at,
  };
}

export type GithubItem = {
  type: "ISSUE" | "PULL_REQUEST";
  number: number;
  title: string;
  /** open · closed · merged · draft */
  state: string;
  htmlUrl: string;
  author: string | null;
  updatedAt: string;
};

type IssuePayload = {
  number: number;
  title: string;
  state: string;
  html_url: string;
  updated_at: string;
  draft?: boolean;
  user: { login: string } | null;
  pull_request?: { merged_at: string | null };
};

function toItem(data: IssuePayload): GithubItem {
  const isPr = !!data.pull_request;
  const state = data.pull_request?.merged_at
    ? "merged"
    : data.draft
      ? "draft"
      : data.state;

  return {
    type: isPr ? "PULL_REQUEST" : "ISSUE",
    number: data.number,
    title: data.title,
    state,
    htmlUrl: data.html_url,
    author: data.user?.login ?? null,
    updatedAt: data.updated_at,
  };
}

export async function fetchItem(
  owner: string,
  name: string,
  number: number,
  token: string | null,
) {
  // /issues/:n serve tanto para issue quanto para PR
  return toItem(
    await gh<IssuePayload>(`/repos/${owner}/${name}/issues/${number}`, token),
  );
}

/** Issues e PRs abertos, para o seletor de vínculo. */
export async function listOpenItems(
  owner: string,
  name: string,
  token: string | null,
) {
  const data = await gh<IssuePayload[]>(
    `/repos/${owner}/${name}/issues?state=open&per_page=50&sort=updated`,
    token,
  );
  return data.map(toItem);
}

export type RepoDaConta = {
  fullName: string;
  descricao: string | null;
  privado: boolean;
  atualizadoEm: string | null;
};

/**
 * Repositórios que o token alcança.
 *
 * Existe para a pessoa **escolher** em vez de digitar `dono/repositório` de
 * memória. Digitar erra: o nome no GitHub raramente é o nome que se fala, e o
 * erro só aparece depois de salvar.
 *
 * `affiliation` inclui organização de propósito: quase todo repositório de
 * trabalho está numa, e sem isso a lista viria só com os pessoais, o que
 * pareceria que o token não funcionou.
 *
 * Uma página de 100, ordenada pelo que mexeu por último. Paginar tudo custaria
 * várias chamadas para um seletor em que ninguém rola até o fim; quem tiver
 * mais que isso continua podendo digitar o nome à mão.
 */
export async function listarReposDaConta(token: string): Promise<RepoDaConta[]> {
  const dados = await gh<
    {
      full_name: string;
      description: string | null;
      private: boolean;
      pushed_at: string | null;
    }[]
  >(
    "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
    token,
  );

  return dados.map((r) => ({
    fullName: r.full_name,
    descricao: r.description,
    privado: r.private,
    atualizadoEm: r.pushed_at,
  }));
}

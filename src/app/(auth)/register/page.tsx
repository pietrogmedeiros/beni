import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Criar sua conta</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Criamos um workspace e um projeto inicial para você.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary-strong hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

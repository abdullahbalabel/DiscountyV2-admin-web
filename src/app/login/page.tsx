"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Mail, Lock, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

function LoginForm() {
  const { t, i18n } = useTranslation();
  const { signIn, forgotPassword, user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"login" | "forgot" | "sent">("login");
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin) {
      window.location.href = "/dashboard";
    }
  }, [user, isAdmin, loading]);

  const switchView = (next: "login" | "forgot" | "sent") => {
    setFade(false);
    setTimeout(() => {
      setError("");
      setView(next);
      setFade(true);
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn(email, password);
    if (result.error) {
      setError(
        result.error === "accessDenied"
          ? t("admin.accessDeniedMessage")
          : t("admin.invalidCredentials")
      );
    }

    setSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await forgotPassword(email);
    if (result.error) {
      setError(result.error);
    } else {
      switchView("sent");
    }

    setSubmitting(false);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  };

  const isRtl = i18n.language === "ar";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" dir={isRtl ? "rtl" : "ltr"}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between bg-primary text-primary-foreground p-10 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/logo-white.svg"
              alt="Discounty"
              width={44}
              height={44}
            />
            <span className="text-xl font-bold tracking-tight">
              {t("admin.title")}
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight">
            {t("admin.loginHeroTitle")}
          </h2>
          <p className="text-primary-foreground/70 text-base leading-relaxed max-w-sm">
            {t("admin.loginHeroDesc")}
          </p>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/50">
          &copy; {new Date().getFullYear()} Discounty
        </div>

        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary-foreground/5" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-primary-foreground/5" />
        <div className="absolute top-1/2 right-[-60px] w-40 h-40 rounded-full bg-primary-foreground/[0.03]" />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 sm:px-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img
              src="/logo.svg"
              alt="Discounty"
              width={32}
              height={32}
            />
            <span className="text-base font-bold">
              {t("admin.title")}
            </span>
          </div>

          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="gap-2 text-muted-foreground"
            >
              <Globe className="h-4 w-4" />
              {i18n.language === "en" ? "عربي" : "English"}
            </Button>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-10">
          <div
            className={`w-full max-w-sm transition-all duration-200 ${
              fade
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            }`}
          >
            {view === "sent" ? (
              /* Success state */
              <div className="text-center space-y-5">
                <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold">
                    {t("admin.checkYourEmail")}
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("admin.forgotPasswordSent")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => switchView("login")}
                >
                  <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
                  {t("admin.backToLogin")}
                </Button>
              </div>
            ) : view === "forgot" ? (
              /* Forgot password */
              <div className="space-y-6">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold">
                    {t("admin.forgotPassword")}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.forgotPasswordHint")}
                  </p>
                </div>

                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">
                      {t("admin.email")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        required
                        dir="ltr"
                        className="ps-9 h-9"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-9"
                    disabled={submitting}
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 animate-spin me-1" />
                    )}
                    {t("admin.sendResetLink")}
                  </Button>

                  <button
                    type="button"
                    className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                    onClick={() => switchView("login")}
                  >
                    <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`} />
                    {t("admin.backToLogin")}
                  </button>
                </form>
              </div>
            ) : (
              /* Login form */
              <div className="space-y-6">
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold">
                    {t("admin.welcomeBack")}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.loginSubtitle")}
                  </p>
                </div>

                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t("admin.email")}</Label>
                    <div className="relative">
                      <Mail className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        required
                        dir="ltr"
                        className="ps-9 h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">
                        {t("admin.password")}
                      </Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => switchView("forgot")}
                      >
                        {t("admin.forgotPassword")}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        dir="ltr"
                        className="ps-9 h-9"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-9"
                    disabled={submitting}
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 animate-spin me-1" />
                    )}
                    {t("admin.signIn")}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}

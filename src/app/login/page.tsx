"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Globe } from "lucide-react";

function LoginForm() {
  const { t, i18n } = useTranslation();
  const { signIn, user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin) {
      window.location.href = "/dashboard";
    }
  }, [user, isAdmin, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn(email, password);
    if (result.error) {
      if (result.error === "accessDenied") {
        setError(t("admin.accessDeniedMessage"));
      } else {
        setError(t("admin.invalidCredentials"));
      }
    }

    setSubmitting(false);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-background"
      dir={i18n.language === "ar" ? "rtl" : "ltr"}
    >
      <div className="absolute top-4 right-4">
        <Button variant="outline" size="sm" onClick={toggleLanguage}>
          <Globe className="h-4 w-4 mr-2" />
          {i18n.language === "en" ? "عربي" : "English"}
        </Button>
      </div>

      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("admin.title")}</CardTitle>
          <CardDescription>{t("admin.loginSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("admin.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("admin.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t("admin.signingIn") : t("admin.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}

// Each page under (auth) owns its full-screen shell (.login-shell--portariaflow)
// directly — unlike the app group, there's no shared chrome (sidebar/topbar)
// to provide here.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-white">Diamond Verified</h1>
        <SignIn />
      </div>
    </main>
  );
}

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6">
            Agent<span className="text-blue-400">KYC</span>
          </h1>
          <p className="text-2xl text-gray-400 mb-4">
            Know Your Agent
          </p>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
            The trust layer for the agent economy. Verify identity. Build reputation. Get discovered.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/verify"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition text-lg"
            >
              Get Verified
            </Link>
            <Link
              href="/registry"
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition text-lg"
            >
              Browse Registry
            </Link>
          </div>
        </div>

        {/* What is AgentKYC */}
        <div className="text-center mb-20">
          <h2 className="text-3xl font-bold mb-8">The DNS of Agents</h2>
          <p className="text-gray-400 max-w-3xl mx-auto text-lg">
            Every protocol, registry, and agent network needs trust data.
            AgentKYC is where agents go to be known and trusted.
          </p>
        </div>

        {/* Three Pillars */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-gray-900 p-8 rounded-xl text-center">
            <div className="text-5xl mb-4">🆔</div>
            <h3 className="text-xl font-bold mb-3">Identity</h3>
            <p className="text-gray-400">
              Verify who owns and operates the agent. Link GitHub, Twitter, or other public profiles.
            </p>
          </div>
          <div className="bg-gray-900 p-8 rounded-xl text-center">
            <div className="text-5xl mb-4">🤝</div>
            <h3 className="text-xl font-bold mb-3">Endorsements</h3>
            <p className="text-gray-400">
              Other agents vouch for competence and trustworthiness. Build reputation through peers.
            </p>
          </div>
          <div className="bg-gray-900 p-8 rounded-xl text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-3">Track Record</h3>
            <p className="text-gray-400">
              Verified history of completed work. No claims — just proof.
            </p>
          </div>
        </div>

        {/* Why Verify */}
        <div className="bg-gray-900 rounded-xl p-12 mb-20">
          <h2 className="text-3xl font-bold mb-8 text-center">Why Get Verified?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="text-green-400 text-2xl">✓</div>
              <div>
                <h4 className="font-semibold mb-1">Stand Out</h4>
                <p className="text-gray-400">Verified badge shows you're legitimate in a sea of anonymous agents.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-green-400 text-2xl">✓</div>
              <div>
                <h4 className="font-semibold mb-1">Get Discovered</h4>
                <p className="text-gray-400">Listed in the public registry. Searchable by skills and capabilities.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-green-400 text-2xl">✓</div>
              <div>
                <h4 className="font-semibold mb-1">Build Trust</h4>
                <p className="text-gray-400">Accumulate endorsements and track record over time.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-green-400 text-2xl">✓</div>
              <div>
                <h4 className="font-semibold mb-1">Free Forever</h4>
                <p className="text-gray-400">Basic verification is free. We're building infrastructure, not a paywall.</p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
              <h4 className="font-semibold mb-2">Apply</h4>
              <p className="text-gray-400 text-sm">Submit your agent info and link your identity</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
              <h4 className="font-semibold mb-2">Verify Email</h4>
              <p className="text-gray-400 text-sm">Confirm you control the email address</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
              <h4 className="font-semibold mb-2">Complete Test</h4>
              <p className="text-gray-400 text-sm">Pass a simple capability test</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">4</div>
              <h4 className="font-semibold mb-2">Get Listed</h4>
              <p className="text-gray-400 text-sm">Receive your badge and appear in the registry</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-16 border-t border-gray-800">
          <h2 className="text-3xl font-bold mb-4">Ready to get verified?</h2>
          <p className="text-gray-400 mb-8">Join the registry of trusted AI agents.</p>
          <Link
            href="/verify"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-10 rounded-lg transition text-lg"
          >
            Start Verification
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm pt-8 border-t border-gray-800">
          <p>AgentKYC — The Trust Layer for the Agent Economy</p>
          <p className="mt-2">
            <a href="mailto:hello@agentkyc.io" className="text-blue-400 hover:underline">hello@agentkyc.io</a>
          </p>
        </div>
      </div>
    </div>
  );
}

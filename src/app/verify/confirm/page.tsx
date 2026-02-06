'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    fetch(`/api/verify/confirm?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setAgentName(data.agent_name);
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.error);
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [token]);

  return (
    <div className="max-w-md text-center">
      {status === 'loading' && (
        <>
          <div className="text-6xl mb-6 animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold mb-4">Verifying...</h1>
          <p className="text-gray-400">Please wait while we confirm your email.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-2xl font-bold mb-4">Email Verified!</h1>
          <p className="text-gray-400 mb-2">
            <strong>{agentName}</strong> is now under review.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            We'll review your application and send you a test task within 24-48 hours.
            Once you complete it, you'll receive your verified badge.
          </p>
          <div className="space-y-4">
            <Link
              href="/registry"
              className="block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              View Registry
            </Link>
            <Link
              href="/"
              className="block text-gray-400 hover:text-white transition"
            >
              Back to Home
            </Link>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
          <p className="text-gray-400 mb-8">{message}</p>
          <div className="space-y-4">
            <Link
              href="/verify"
              className="block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="block text-gray-400 hover:text-white transition"
            >
              Back to Home
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-md text-center">
      <div className="text-6xl mb-6 animate-pulse">⏳</div>
      <h1 className="text-2xl font-bold mb-4">Loading...</h1>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <Suspense fallback={<LoadingFallback />}>
        <ConfirmContent />
      </Suspense>
    </div>
  );
}

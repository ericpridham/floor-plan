@extends('layouts.app')

@section('title', 'Sign In')

@section('content')
<div class="min-h-[60vh] flex items-center justify-center">
    <div class="w-full max-w-md">
        <h1 class="text-2xl font-bold text-gray-900 mb-6 text-center">Sign in to your account</h1>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <form method="POST" action="{{ route('login') }}" novalidate>
                @csrf

                <div class="mb-5">
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value="{{ old('email') }}"
                        required
                        autocomplete="email"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 @error('email') border-red-400 bg-red-50 @else border-gray-300 @enderror"
                    >
                    @error('email')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="mb-5">
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        required
                        autocomplete="current-password"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 @error('password') border-red-400 bg-red-50 @else border-gray-300 @enderror"
                    >
                    @error('password')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <div class="mb-6 flex items-center gap-2">
                    <input type="checkbox" id="remember" name="remember" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <label for="remember" class="text-sm text-gray-600">Remember me for 30 days</label>
                </div>

                <button type="submit" class="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                    Sign in
                </button>
            </form>
        </div>

        <p class="mt-6 text-center text-sm text-gray-600">
            Don't have an account?
            <a href="{{ route('register') }}" class="font-medium text-indigo-600 hover:text-indigo-700">Create one</a>
        </p>
    </div>
</div>
@endsection

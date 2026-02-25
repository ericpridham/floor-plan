@extends('layouts.app')

@section('title', 'Create Account')

@section('content')
<div class="min-h-[60vh] flex items-center justify-center">
    <div class="w-full max-w-md">
        <h1 class="text-2xl font-bold text-gray-900 mb-6 text-center">Create your account</h1>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <form method="POST" action="{{ route('register') }}" novalidate>
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
                        autocomplete="new-password"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 @error('password') border-red-400 bg-red-50 @else border-gray-300 @enderror"
                    >
                    @error('password')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                    <p class="mt-1 text-xs text-gray-500">Minimum 8 characters.</p>
                </div>

                <div class="mb-6">
                    <label for="password_confirmation" class="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                    <input
                        type="password"
                        id="password_confirmation"
                        name="password_confirmation"
                        required
                        autocomplete="new-password"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 @error('password_confirmation') border-red-400 bg-red-50 @else border-gray-300 @enderror"
                    >
                    @error('password_confirmation')
                        <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                    @enderror
                </div>

                <button type="submit" class="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                    Create account
                </button>
            </form>
        </div>

        <p class="mt-6 text-center text-sm text-gray-600">
            Already have an account?
            <a href="{{ route('login') }}" class="font-medium text-indigo-600 hover:text-indigo-700">Sign in</a>
        </p>
    </div>
</div>
@endsection

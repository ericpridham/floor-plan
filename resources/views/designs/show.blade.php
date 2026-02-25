@extends('layouts.app')
@section('title', $design->name)
@section('content')
<div class="max-w-2xl mx-auto text-center py-20">
    <h1 class="text-2xl font-bold text-gray-900 mb-2">{{ $design->name }}</h1>
    <p class="text-sm text-gray-500 mb-6">Design canvas coming in Phase 5.</p>
    <a href="{{ route('dashboard') }}" class="text-indigo-600 text-sm hover:underline">← Back to Dashboard</a>
</div>
@endsection

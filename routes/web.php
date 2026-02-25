<?php

use App\Http\Controllers\Api;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DesignController;
use App\Http\Controllers\FloorplanController;
use App\Http\Controllers\FloorplanSetupController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn() => redirect()->route('dashboard'));

Route::middleware('guest')->group(function () {
    Route::get('/register', [RegisterController::class, 'showForm'])->name('register');
    Route::post('/register', [RegisterController::class, 'register'])->middleware('throttle:10,1');
    Route::get('/login', [LoginController::class, 'showForm'])->name('login');
    Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:10,1');
});

Route::post('/logout', [LoginController::class, 'logout'])->name('logout')->middleware('auth');

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/floorplans/create', [FloorplanController::class, 'create'])->name('floorplans.create');
    Route::post('/floorplans', [FloorplanController::class, 'store'])->name('floorplans.store');
    Route::patch('/floorplans/{floorplan}', [FloorplanController::class, 'update'])->name('floorplans.update');
    Route::delete('/floorplans/{floorplan}', [FloorplanController::class, 'destroy'])->name('floorplans.destroy');

    // Phase 3
    Route::get('/floorplans/{floorplan}/setup', [FloorplanSetupController::class, 'show'])->name('floorplans.setup');
    Route::get('/api/floorplans/{floorplan}/rooms', [Api\RoomSyncController::class, 'index'])->name('api.rooms.index');
    Route::put('/api/floorplans/{floorplan}/rooms', [Api\RoomSyncController::class, 'sync'])->name('api.rooms.sync');

    // Phase 4
    Route::get('/designs/create', [DesignController::class, 'create'])->name('designs.create');
    Route::post('/designs', [DesignController::class, 'store'])->name('designs.store');
    Route::get('/designs/{design}', [DesignController::class, 'show'])->name('designs.show');
    Route::patch('/designs/{design}', [DesignController::class, 'update'])->name('designs.update');
    Route::delete('/designs/{design}', [DesignController::class, 'destroy'])->name('designs.destroy');
});

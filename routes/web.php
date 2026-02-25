<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FloorplanController;
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
});

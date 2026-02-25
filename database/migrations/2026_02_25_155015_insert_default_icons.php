<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Run the IconLibrarySeeder
        Artisan::call('db:seed', [
            '--class' => 'Database\\Seeders\\IconLibrarySeeder',
            '--force' => true,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration shouldn't drop the data on rollback
        // just in case users want to keep the uploaded custom icons
        // but we could optionally remove the built-in icons
        \Illuminate\Support\Facades\DB::table('icon_libraries')->whereNull('user_id')->delete();
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('icon_library', 'icon_libraries');
    }

    public function down(): void
    {
        Schema::rename('icon_libraries', 'icon_library');
    }
};

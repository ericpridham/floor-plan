<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('icon_library', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category', 50);
            $table->string('label', 100);
            $table->string('svg_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('icon_library');
    }
};

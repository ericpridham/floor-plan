<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('design_icons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('design_id')->constrained()->cascadeOnDelete();
            $table->foreignId('icon_library_id')->constrained('icon_library')->cascadeOnDelete();
            $table->decimal('x', 10, 4);
            $table->decimal('y', 10, 4);
            $table->decimal('width', 10, 4);
            $table->decimal('height', 10, 4);
            $table->decimal('rotation', 6, 2)->default(0);
            $table->boolean('is_free_placed')->default(false);
            $table->unsignedSmallInteger('z_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('design_icons');
    }
};

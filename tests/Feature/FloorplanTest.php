<?php

namespace Tests\Feature;

use App\Models\Floorplan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FloorplanTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Create a minimal valid PNG UploadedFile without requiring GD.
     * Uses the raw bytes of a 1×1 white PNG image.
     */
    private function fakePng(string $filename = 'floor.png'): UploadedFile
    {
        // Minimal 1×1 white PNG (67 bytes)
        $pngBytes = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='
        );

        $tmp = tempnam(sys_get_temp_dir(), 'png_');
        file_put_contents($tmp, $pngBytes);

        return new UploadedFile($tmp, $filename, 'image/png', null, true);
    }

    // -------------------------------------------------------------------------
    // Upload tests
    // -------------------------------------------------------------------------

    public function test_upload_form_requires_authentication(): void
    {
        $response = $this->get('/floorplans/create');

        $response->assertRedirect('/login');
    }

    public function test_upload_form_is_accessible_to_authenticated_user(): void
    {
        $user = User::factory()->create();

        $response = $this->withoutVite()->actingAs($user)->get('/floorplans/create');

        $response->assertStatus(200);
    }

    public function test_user_can_upload_a_floorplan(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $file = $this->fakePng('floor.png');

        $response = $this->actingAs($user)->post('/floorplans', [
            'name'  => 'My Floorplan',
            'image' => $file,
        ]);

        $response->assertRedirect(route('dashboard'));

        $this->assertDatabaseHas('floorplans', [
            'user_id' => $user->id,
            'name'    => 'My Floorplan',
        ]);

        $floorplan = Floorplan::where('user_id', $user->id)->first();
        $this->assertDatabaseHas('file_uploads', ['path' => $floorplan->image_path]);
    }

    public function test_upload_fails_with_missing_name(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $file = $this->fakePng('floor.png');

        $response = $this->actingAs($user)->post('/floorplans', [
            'image' => $file,
        ]);

        $response->assertSessionHasErrors('name');
    }

    public function test_upload_fails_with_missing_image(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/floorplans', [
            'name' => 'My Floorplan',
        ]);

        $response->assertSessionHasErrors('image');
    }

    public function test_upload_fails_with_invalid_file_type(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('document.txt', 10, 'text/plain');

        $response = $this->actingAs($user)->post('/floorplans', [
            'name'  => 'My Floorplan',
            'image' => $file,
        ]);

        $response->assertSessionHasErrors('image');
    }

    public function test_upload_fails_when_image_exceeds_max_size(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('big.png', 21000, 'image/png');

        $response = $this->actingAs($user)->post('/floorplans', [
            'name'  => 'Big Floorplan',
            'image' => $file,
        ]);

        $response->assertSessionHasErrors('image');
    }

    // -------------------------------------------------------------------------
    // Rename tests
    // -------------------------------------------------------------------------

    public function test_user_can_rename_their_floorplan(): void
    {
        $user = User::factory()->create();

        $floorplan = Floorplan::create([
            'user_id'    => $user->id,
            'name'       => 'Test Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);

        $response = $this->actingAs($user)->patch("/floorplans/{$floorplan->id}", [
            'name' => 'Renamed Plan',
        ]);

        $response->assertRedirect(route('dashboard'));

        $this->assertDatabaseHas('floorplans', [
            'id'   => $floorplan->id,
            'name' => 'Renamed Plan',
        ]);
    }

    public function test_rename_fails_with_empty_name(): void
    {
        $user = User::factory()->create();

        $floorplan = Floorplan::create([
            'user_id'    => $user->id,
            'name'       => 'Test Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);

        $response = $this->actingAs($user)->patch("/floorplans/{$floorplan->id}", [
            'name' => '',
        ]);

        $response->assertSessionHasErrors('name');
    }

    public function test_user_cannot_rename_another_users_floorplan(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $floorplan = Floorplan::create([
            'user_id'    => $owner->id,
            'name'       => 'Test Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);

        $response = $this->actingAs($other)->patch("/floorplans/{$floorplan->id}", [
            'name' => 'Hijacked Name',
        ]);

        $response->assertStatus(403);
    }

    // -------------------------------------------------------------------------
    // Delete tests
    // -------------------------------------------------------------------------

    public function test_user_can_delete_their_floorplan(): void
    {
        $user = User::factory()->create();

        $floorplan = Floorplan::create([
            'user_id'    => $user->id,
            'name'       => 'Test Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);

        \App\Models\FileUpload::create([
            'path' => $floorplan->image_path,
            'mime_type' => 'image/png',
            'base64_content' => base64_encode('fake image content')
        ]);

        $response = $this->actingAs($user)->delete("/floorplans/{$floorplan->id}");

        $response->assertRedirect(route('dashboard'));

        $this->assertDatabaseMissing('floorplans', ['id' => $floorplan->id]);
        $this->assertDatabaseMissing('file_uploads', ['path' => $floorplan->image_path]);
    }

    public function test_user_cannot_delete_another_users_floorplan(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $floorplan = Floorplan::create([
            'user_id'    => $owner->id,
            'name'       => 'Test Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);

        $response = $this->actingAs($other)->delete("/floorplans/{$floorplan->id}");

        $response->assertStatus(403);
    }

    // -------------------------------------------------------------------------
    // Dashboard tests
    // -------------------------------------------------------------------------

    public function test_dashboard_shows_floorplans(): void
    {
        $user = User::factory()->create();

        Floorplan::create([
            'user_id'    => $user->id,
            'name'       => 'My Living Room Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);

        $response = $this->withoutVite()->actingAs($user)->get('/dashboard');

        $response->assertStatus(200);
        $response->assertSee('My Living Room Plan');
    }

    public function test_dashboard_shows_empty_state_when_no_floorplans(): void
    {
        $user = User::factory()->create();

        $response = $this->withoutVite()->actingAs($user)->get('/dashboard');

        $response->assertStatus(200);
        $response->assertSee('No floorplans yet');
    }

    // -------------------------------------------------------------------------
    // Edge case tests
    // -------------------------------------------------------------------------

    private function fakeGif(): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'gif');
        file_put_contents($tmp, base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'));
        return new UploadedFile($tmp, 'image.gif', 'image/gif', null, true);
    }

    public function test_upload_rejects_real_image_with_disallowed_type(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('floorplans.store'), [
            'name'  => 'My GIF',
            'image' => $this->fakeGif(),
        ]);

        $response->assertSessionHasErrors('image');
        $this->assertDatabaseMissing('floorplans', ['user_id' => $user->id]);
    }

    public function test_delete_removes_image_when_floorplan_has_rooms(): void
    {
        $user = User::factory()->create();
        $floorplan = Floorplan::create([
            'user_id'    => $user->id,
            'name'       => 'With Rooms',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);
        \App\Models\FileUpload::create([
            'path' => 'floorplans/1/test.png',
            'mime_type' => 'image/png',
            'base64_content' => base64_encode('fake image content')
        ]);
        // Create a room
        \App\Models\Room::create([
            'floorplan_id' => $floorplan->id,
            'name' => 'Living Room',
            'x' => 10, 'y' => 10, 'width' => 50, 'height' => 50,
        ]);

        $response = $this->actingAs($user)->delete(route('floorplans.destroy', $floorplan));

        $response->assertRedirect(route('dashboard'));
        $this->assertDatabaseMissing('floorplans', ['id' => $floorplan->id]);
        $this->assertDatabaseMissing('rooms', ['floorplan_id' => $floorplan->id]);
        $this->assertDatabaseMissing('file_uploads', ['path' => 'floorplans/1/test.png']);
    }
}

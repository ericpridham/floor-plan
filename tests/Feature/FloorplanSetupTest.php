<?php

namespace Tests\Feature;

use App\Models\Floorplan;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FloorplanSetupTest extends TestCase
{
    use RefreshDatabase;

    private function makeFloorplan(User $user): Floorplan
    {
        return Floorplan::create([
            'user_id'    => $user->id,
            'name'       => 'Test Plan',
            'image_path' => 'floorplans/1/test.png',
            'width_px'   => 800,
            'height_px'  => 600,
        ]);
    }

    private function roomsPayload(): array
    {
        return [
            'rooms' => [
                ['name' => 'Living Room', 'x' => 10.0, 'y' => 20.0, 'width' => 30.0, 'height' => 25.0],
                ['name' => 'Bedroom',     'x' => 50.0, 'y' => 10.0, 'width' => 20.0, 'height' => 40.0],
            ],
        ];
    }

    // -------------------------------------------------------------------------

    public function test_setup_page_requires_auth(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        $this->get("/floorplans/{$floorplan->id}/setup")
            ->assertRedirect('/login');
    }

    public function test_setup_page_shows_for_owner(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        $this->withoutVite()->actingAs($owner)
            ->get("/floorplans/{$floorplan->id}/setup")
            ->assertStatus(200);
    }

    public function test_setup_page_forbidden_for_non_owner(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        $this->actingAs($other)
            ->get("/floorplans/{$floorplan->id}/setup")
            ->assertStatus(403);
    }

    public function test_room_index_returns_json(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        Room::create(['floorplan_id' => $floorplan->id, 'name' => 'Kitchen', 'x' => 5, 'y' => 5, 'width' => 20, 'height' => 15]);

        $this->actingAs($owner)
            ->getJson("/api/floorplans/{$floorplan->id}/rooms")
            ->assertStatus(200)
            ->assertJsonStructure([['id', 'floorplan_id', 'name', 'x', 'y', 'width', 'height']]);
    }

    public function test_room_index_forbidden_for_non_owner(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $floorplan = Floorplan::create([
            'user_id' => $owner->id, 'name' => 'Test', 'image_path' => 'fp.png',
            'width_px' => 800, 'height_px' => 600,
        ]);

        $response = $this->actingAs($other)
            ->getJson(route('api.rooms.index', $floorplan));

        $response->assertStatus(403);
    }

    public function test_room_sync_creates_rooms(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        $this->actingAs($owner)
            ->putJson("/api/floorplans/{$floorplan->id}/rooms", $this->roomsPayload())
            ->assertStatus(200)
            ->assertJson(['saved' => true]);

        $this->assertDatabaseHas('rooms', ['floorplan_id' => $floorplan->id, 'name' => 'Living Room']);
        $this->assertDatabaseHas('rooms', ['floorplan_id' => $floorplan->id, 'name' => 'Bedroom']);
    }

    public function test_room_sync_replaces_existing_rooms(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        Room::create(['floorplan_id' => $floorplan->id, 'name' => 'Old Room', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 10]);

        $this->actingAs($owner)
            ->putJson("/api/floorplans/{$floorplan->id}/rooms", [
                'rooms' => [
                    ['name' => 'New Room', 'x' => 5.0, 'y' => 5.0, 'width' => 20.0, 'height' => 20.0],
                ],
            ])
            ->assertStatus(200)
            ->assertJson(['saved' => true]);

        $this->assertDatabaseMissing('rooms', ['floorplan_id' => $floorplan->id, 'name' => 'Old Room']);
        $this->assertDatabaseHas('rooms', ['floorplan_id' => $floorplan->id, 'name' => 'New Room']);
    }

    public function test_room_sync_validates_room_data(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        $this->actingAs($owner)
            ->putJson("/api/floorplans/{$floorplan->id}/rooms", [
                'rooms' => [
                    ['x' => 10.0, 'y' => 10.0, 'width' => 20.0, 'height' => 20.0],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['rooms.0.name']);
    }

    public function test_room_sync_forbidden_for_non_owner(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        $this->actingAs($other)
            ->putJson("/api/floorplans/{$floorplan->id}/rooms", $this->roomsPayload())
            ->assertStatus(403);
    }

    public function test_room_sync_accepts_empty_array(): void
    {
        $owner    = User::factory()->create();
        $floorplan = $this->makeFloorplan($owner);

        Room::create(['floorplan_id' => $floorplan->id, 'name' => 'To Delete', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 10]);

        $this->actingAs($owner)
            ->putJson("/api/floorplans/{$floorplan->id}/rooms", ['rooms' => []])
            ->assertStatus(200)
            ->assertJson(['saved' => true]);

        $this->assertDatabaseMissing('rooms', ['floorplan_id' => $floorplan->id]);
    }
}

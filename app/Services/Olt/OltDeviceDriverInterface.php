<?php
namespace App\Services\Olt;

interface OltDeviceDriverInterface {
    public function getDeviceInfo(): array;
    public function getPonPorts(): array;
    public function getOnuList(): array;
    public function getUnconfiguredOnus(): array;
    public function authorizeOnu(string $serialNumber, string $profileId): bool;
    public function getOnuOpticalPower(string $serialNumber): array;
}
?>

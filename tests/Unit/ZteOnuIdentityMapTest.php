<?php

namespace Tests\Unit;

use App\Services\Olt\ZteOnuIdentityMap as Identity;
use PHPUnit\Framework\TestCase;

class ZteOnuIdentityMapTest extends TestCase
{
    public function test_serial_tables_preserve_individual_pon_and_onu_ids_including_onu_one(): void
    {
        $p15 = Identity::ifIndexFromPort('1/1/15'); $p16 = Identity::ifIndexFromPort('gpon-olt_1/1/16');
        $rows = Identity::fromTables([
            '.'.Identity::PRIMARY.".$p15.1" => 'TEST'.hex2bin('00000001'),
            Identity::PRIMARY.".$p16.1" => 'Hex-STRING: 54 45 53 54 00 00 00 02',
        ], [Identity::SECONDARY.".$p16.2" => 'STRING: "TEST00000003"']);
        $this->assertSame(["{$p15}_1"=>'TEST00000001',"{$p16}_1"=>'TEST00000002',"{$p16}_2"=>'TEST00000003'], $rows);
        $this->assertSame('gpon-olt_1/1/1', Identity::portFromIfIndex(Identity::ifIndexFromPort('gpon_1/1/1')));
        $this->assertSame('gpon-olt_1/1/16', Identity::portFromIfIndex($p16));
    }

    public function test_conflicting_tables_and_reused_serials_do_not_choose_a_location(): void
    {
        $idx = Identity::ifIndexFromPort('1/1/15');
        $a=[Identity::PRIMARY.".$idx.1"=>'TEST00000001',Identity::PRIMARY.".$idx.2"=>'TEST00000003'];
        $b=[Identity::SECONDARY.".$idx.1"=>'TEST00000002',Identity::SECONDARY.".$idx.3"=>'TEST00000003'];
        $this->assertSame([], Identity::fromTables($a,$b));
        $this->assertSame([], Identity::fromTables(array_reverse($a,true),array_reverse($b,true)));
    }

    public function test_malformed_oids_and_values_never_create_default_hardware_locations(): void
    {
        $idx = Identity::ifIndexFromPort('1/1/15'); $rows=[];
        foreach ([Identity::PRIMARY.".$idx.1.1",Identity::SECONDARY.".$idx.1",Identity::PRIMARY.".$idx.0",Identity::PRIMARY.'.1.1',Identity::PRIMARY.'.4563463936.1'] as $oid) $rows[$oid]='TEST00000001';
        $rows[Identity::PRIMARY.".$idx.4"]='No Such Instance currently exists at this OID';
        $rows[Identity::PRIMARY.".$idx.5"]='000000000000';
        $this->assertSame([], Identity::fromTables($rows,[]));
        foreach (['','1/1','1/0/1','1/256/1','2/1/1','epon_0/1','1/1/15:1','1/1/15,1/1/16'] as $port) $this->assertNull(Identity::ifIndexFromPort($port));
    }

    public function test_legacy_or_invalid_cache_is_rejected_and_new_cache_keeps_only_scalar_entries(): void
    {
        $key=Identity::ifIndexFromPort('1/1/15').'_1';
        $cache=['schema'=>2,'observed_at'=>date(DATE_ATOM),'entries'=>[$key=>'TEST00000001']];
        $this->assertSame($cache['entries'],Identity::cachedEntries($cache));
        $this->assertNotSame('olt_bulk_sn_map_1',Identity::cacheKey(1));
        foreach ([$cache['entries'],null,(object)$cache, array_replace($cache,['schema'=>1]),array_replace($cache,['observed_at'=>date(DATE_ATOM,time()-601)]),array_replace($cache,['entries'=>[$key=>new \stdClass]]),array_replace($cache,['entries'=>[$key=>'TEST00000001',Identity::ifIndexFromPort('1/1/16').'_1'=>'TEST00000001']])] as $bad) $this->assertSame([],Identity::cachedEntries($bad));
    }

    public function test_snapshot_identity_requires_hardware_provenance_and_unique_location(): void
    {
        $row=['serial_number'=>'TEST00000001','port'=>'1/1/16','onu_id'=>1,'identity_source'=>Identity::SOURCE];
        $this->assertSame('gpon-olt_1/1/16',Identity::uniqueRows([$row])['TEST00000001']['port']);
        $this->assertSame([],Identity::uniqueRows([array_replace($row,['identity_source'=>null,'ont_id'=>1755,'onu_id'=>1755])]));
        $this->assertSame([],Identity::uniqueRows([$row,array_replace($row,['port'=>'1/1/15'])]));
        $this->assertSame([],Identity::uniqueRows([$row,array_replace($row,['serial_number'=>'TEST00000002'])]));
        $this->assertCount(1,Identity::uniqueRows([$row,$row]));
    }
}

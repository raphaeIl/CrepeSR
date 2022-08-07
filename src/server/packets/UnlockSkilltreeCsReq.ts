import { AvatarSkillTree, UnlockSkilltreeCsReq, UnlockSkilltreeScRsp } from "../../data/proto/StarRail";
import Packet from "../kcp/Packet";
import Avatar from "../../db/Avatar";
import Session from "../kcp/Session";
import { PayItemData } from "../../db/Inventory";

export default async function handle(session: Session, packet: Packet) {
    const body = packet.body as UnlockSkilltreeCsReq;

    const pointId = body.pointId;
    const avatarId = ~~(pointId / 1000) // apprently first four digits of pointId is the avatarId
    const avatar = await Avatar.loadAvatarForPlayer(session.player, avatarId);

    const inventory = await session.player.getInventory();
    
    const costMaterialList: Array<PayItemData> = [];

    // Get all the materials and currency needed to upgrade the skill
    for (let i = 0; i < body.itemList.length; i++) {
        const item = body.itemList[i];
        if (!item.pileItem) continue;

        costMaterialList.push({
            count: item.pileItem.itemNum,
            id: item.pileItem.itemId
        });
    }

    // Pay the required materials
    const success = await inventory.payItems(costMaterialList);

    if (!success) {
        session.send(UnlockSkilltreeScRsp, { retcode: 1 } as UnlockSkilltreeScRsp);
        return;
    }

    // Level up the skill
    const skill: AvatarSkillTree | undefined = avatar.db.skilltreeList.find(s => s.pointId == pointId)

    if (skill != undefined)
        skill.level++;
    else
        avatar.db.skilltreeList.push({
            level: 1,
            pointId: pointId
        })

    // Save, Sync and send response.
    await inventory.save();
    await avatar.save();

    await session.sync();

    await session.send(UnlockSkilltreeScRsp, {
        retcode: 0,
        baseAvatarId: avatarId,
        level: skill?.level,
        pointId: body.pointId
    } as UnlockSkilltreeScRsp);
}
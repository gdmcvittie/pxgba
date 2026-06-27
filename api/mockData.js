const mockTilesetBmpBase64 = 
  "Qk02MAAAAAAAADYAAAAoAAAAQAAAAMD///8BABgAAAAAAAAwAAATCwAAEwsAAAAAAAAAAAAAIshaIosiIosiIshaIosiIosiIshaIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIshaIosiIosiIshaIosiIosiIsha/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIshaIosiIosiIshaIosiIosiIshaIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIshaIosiIosiIshaIosiIosiIsha3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIshaIosiIosiIshaIosiIosiIshaIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIshaIosiIosiIshaIosiIosiIsha3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qL/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIshaIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIshaIosiIosiIshaIosiIosiIshaIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIshaIosiIosiIshaIosiIosiIsha3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIshaIosiIosiIshaIosiIosiIshaIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIshaIosiIosiIshaIosiIosiIsha/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi/5Ae3JAe3JAe3JAe/5Ae3JAe3JAe3JAeoKCgoKCgoKCgUFBQUFBQoKCgoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgoKCgUFBQoKCgoKCgUFBQoKCgoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIshaIosiIosiIshaIosiIosiIshaIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeoKCgUFBQoKCgoKCgoKCgoKCgUFBQoKCgK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQK1qLK1qLK1qLK1qLK1qLK1qLK1qLK1qLIosiIosiIosiIosiIosiIosiIosiIosi3JAe3JAe3JAe3JAe3JAe3JAe3JAe3JAeUFBQoKCgoKCgoKCgoKCgoKCgoKCgUFBQ";

const mockSearchHtml = `
<!DOCTYPE html>
<html>
<head><title>OpenGameArt.org Search</title></head>
<body>
  <div class="main-content">
    <div class="art-preview">
      <div class="art-preview-title">
        <a href="/content/mock-overworld-tileset">Overworld Grass & Water Tileset</a>
      </div>
      <div class="field-name-field-art-preview">
        <a href="/content/mock-overworld-tileset">
          <img src="/proxy-oga?url=https%3A%2F%2Fopengameart.org%2Fmock-preview-overworld" alt="Preview">
        </a>
      </div>
    </div>
    <div class="art-preview">
      <div class="art-preview-title">
        <a href="/content/mock-dungeon-tileset">Classic Dungeon Stone Tileset</a>
      </div>
      <div class="field-name-field-art-preview">
        <a href="/content/mock-dungeon-tileset">
          <img src="/proxy-oga?url=https%3A%2F%2Fopengameart.org%2Fmock-preview-dungeon" alt="Preview">
        </a>
      </div>
    </div>
    <div class="art-preview">
      <div class="art-preview-title">
        <a href="/content/mock-castle-tileset">Retro Pixel Castle Tileset</a>
      </div>
      <div class="field-name-field-art-preview">
        <a href="/content/mock-castle-tileset">
          <img src="/proxy-oga?url=https%3A%2F%2Fopengameart.org%2Fmock-preview-castle" alt="Preview">
        </a>
      </div>
    </div>
  </div>
</body>
</html>
`;

const mockDetailsHtml = `
<!DOCTYPE html>
<html>
<head><title>Tileset Details</title></head>
<body>
  <div class="field field-name-field-art-files field-type-file field-label-above">
    <div class="field-label">Files:&nbsp;</div>
    <div class="field-items">
      <div class="field-item">
        <a href="/proxy-oga?url=https%3A%2F%2Fopengameart.org%2Fsites%2Fdefault%2Ffiles%2Fmock-file-tileset.zip">mock-tileset.zip</a>
      </div>
      <div class="field-item">
        <a href="/proxy-oga?url=https%3A%2F%2Fopengameart.org%2Fsites%2Fdefault%2Ffiles%2Fmock-file-single.png">mock-file-single.png</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

const mockModSearchHtml = `
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>
<body>
<div class="bgsegment top2">
<table cellpadding="0" cellspacing="5" border="0">
<tr>
<td valign="top" width="75">
<a href="javascript:popUpKeep('player.php?92118',550,400);" title="Play"><img src="style/images/icons/control_play.png" border="0" class="famicon" alt="Play"></a> <a href="https://api.modarchive.org/downloads.php?moduleid=92118#delicious_overworld.mod" title="Download"><img class="inline" src="style/images/icons/world_go.png" alt="GRAB!" border="0"></a>
<span class="format-icon">MOD</span>
</td>
<td valign="top" width="200">
<a class="standard-link" href="index.php?request=view_by_moduleid&amp;query=92118" title="overworld">delicious_overworld.mod</a>
</td>
<td valign="top" width="300">
<span class="module-listing">
overworld
</span>
</td>
<td valign="top">
<span class='module-listing'>Unrated</span>
<br><span class='module-detail'>Artist(s):</span> <a class='module-detail' href="member.php?999">delicious</a>&nbsp;
</td>
</tr>
<tr>
<td valign="top" width="75">
<a href="javascript:popUpKeep('player.php?178701',550,400);" title="Play"><img src="style/images/icons/control_play.png" border="0" class="famicon" alt="Play"></a> <a href="https://api.modarchive.org/downloads.php?moduleid=178701#groovin_-_over.gdm" title="Download"><img class="inline" src="style/images/icons/world_go.png" alt="GRAB!" border="0"></a>
<span class="format-icon">GDM</span>
</td>
<td valign="top" width="200">
<a class="standard-link" href="index.php?request=view_by_moduleid&amp;query=178701" title="Overworld">groovin_-_over.gdm</a>
</td>
<td valign="top" width="300">
<span class="module-listing">
Overworld
</span>
</td>
<td valign="top">
<span class='module-listing'>Unrated</span>
</td>
</tr>
<tr>
<td valign="top" width="75">
<a href="javascript:popUpKeep('player.php?129025',550,400);" title="Play"><img src="style/images/icons/control_play.png" border="0" class="famicon" alt="Play"></a> <a href="https://api.modarchive.org/downloads.php?moduleid=129025#overworld.mod" title="Download"><img class="inline" src="style/images/icons/world_go.png" alt="GRAB!" border="0"></a>
<span class="format-icon">MOD</span>
</td>
<td valign="top" width="200">
<a class="standard-link" href="index.php?request=view_by_moduleid&amp;query=129025" title="overworld">overworld.mod</a>
</td>
<td valign="top" width="300">
<span class="module-listing">
overworld
</span>
</td>
<td valign="top">
<span class='module-listing'>Unrated</span>
<br><span class='module-detail'>Artist(s):</span> <a class='module-detail' href="member.php?888">unknown_artist</a>&nbsp;
</td>
</tr>
<tr>
<td valign="top" width="75">
<a href="javascript:popUpKeep('player.php?185120',550,400);" title="Play"><img src="style/images/icons/control_play.png" border="0" class="famicon" alt="Play"></a> <a href="https://api.modarchive.org/downloads.php?moduleid=185120#skyline_-_overworld_theme_rpga.it" title="Download"><img class="inline" src="style/images/icons/world_go.png" alt="GRAB!" border="0"></a>
<span class="format-icon">IT</span>
</td>
<td valign="top" width="200">
<a class="standard-link" href="index.php?request=view_by_moduleid&amp;query=185120" title="Overworld Theme RPGA">skyline_-_overworld_theme_rpga.it</a>
</td>
<td valign="top" width="300">
<span class="module-listing">
Overworld Theme RPGA
</span>
</td>
<td valign="top">
<span class='module-listing'>Unrated</span>
</td>
</tr>
<tr>
<td valign="top" width="75">
<a href="javascript:popUpKeep('player.php?61570',550,400);" title="Play"><img src="style/images/icons/control_play.png" border="0" class="famicon" alt="Play"></a> <a href="https://api.modarchive.org/downloads.php?moduleid=61570#wc_owoli.xm" title="Download"><img class="inline" src="style/images/icons/world_go.png" alt="GRAB!" border="0"></a>
<span class="format-icon">XM</span>
</td>
<td valign="top" width="200">
<a class="standard-link" href="index.php?request=view_by_moduleid&amp;query=61570" title="overworld life">wc_owoli.xm</a>
</td>
<td valign="top" width="300">
<span class="module-listing">
overworld life
</span>
</td>
<td valign="top">
<span class='module-listing'>Unrated</span>
</td>
</tr>
<tr>
<td valign="top" width="75">
<a href="javascript:popUpKeep('player.php?111111',550,400);" title="Play"><img src="style/images/icons/control_play.png" border="0" class="famicon" alt="Play"></a> <a href="https://api.modarchive.org/downloads.php?moduleid=111111#battle_theme.s3m" title="Download"><img class="inline" src="style/images/icons/world_go.png" alt="GRAB!" border="0"></a>
<span class="format-icon">S3M</span>
</td>
<td valign="top" width="200">
<a class="standard-link" href="index.php?request=view_by_moduleid&amp;query=111111" title="battle_theme">battle_theme.s3m</a>
</td>
<td valign="top" width="300">
<span class="module-listing">
battle theme
</span>
</td>
<td valign="top">
<span class='module-listing'>Unrated</span>
<br><span class='module-detail'>Artist(s):</span> <a class='module-detail' href="member.php?777">composer</a>&nbsp;
</td>
</tr>
</table>
</div>
</body>
</html>
`;

module.exports = {
  mockTilesetBmpBase64,
  mockSearchHtml,
  mockDetailsHtml,
  mockModSearchHtml
};


# GentianAphrodite

这是一个男性向AI角色卡的开发仓库。

## 只想构建角色卡？  

使用`npm run build`命令，无需链接。

## 配置并链接至角色卡

使用`npm install`命令安装依赖，创建`src/data/cardpath.txt`和`src/data/WIpath.txt`文件，内容设置为在使用的角色卡和其世界书的路径。  
![图片](https://github.com/steve02081504/GentianAphrodite/assets/31927825/df2a0065-0e1d-43a8-8eb0-7e399f6cd0fa)
![图片](https://github.com/steve02081504/GentianAphrodite/assets/31927825/4fbb1b11-962b-4950-a5f7-bb381cd149c1)

## 更新信息

在此仓库中运行`npm run update-data`，自角色卡更新仓库中的信息。  
运行`npm run update-cardfile`，更新仓库信息至角色卡中。  
  
使用`npm run hooks-install`命令，将git hooks设置为`src/.githooks`目录，以在pull等操作时自动更新卡片信息。

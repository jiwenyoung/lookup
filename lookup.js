const dns = require('dns').promises
const commander = require('commander')
const isdomain = require('@whoisinfo/isdomain')
const isIP = require('isipaddress')
const axios = require('axios')
const country = require('country-list')

const main = async () => {
  try{
    const program = new commander.Command()
    program.argument('[source]', 'The IP or domain you want to lookup', (value)=>{
      if(isdomain(value) || isIP.test(value)){
        return value
      }else{
        throw new Error('Please check if your source is correct')
      }
    })
    program.option('-s, --server <server>', 'which name server do you want to use', (value)=>{
      if(isIP.test(value)){
        return value
      }else{
        throw new Error('Please check if your name server is correct')
      }
    })
    program.action(async (source, options) => {
      if(source !== undefined){
        let isFromNameToIP = isdomain(source)
        let nameserver = []
        if(options.server){
          nameserver.push(options.server)
        }else{
          if(isFromNameToIP){
            nameserver = await dns.getServers()
          }else{
            nameserver = ['8.8.8.8', '8.8.4.4', '1.1.1.1', '114.114.114.114']
          }
        }
        
        if(isFromNameToIP){
          dns.setServers(nameserver)
          let results = []
          
          const getIPs = async (protocol, source)=>{
            try{
              if(protocol === '4'){
                return await dns.resolve4(source, {ttl: true})
              }
              if(protocol === '6'){
                return await dns.resolve6(source, { ttl: true })
              }
              return []
            }catch(error){
              return []
            }
          }
          
          let tasks = []
          tasks.push(getIPs('4', source))
          tasks.push(getIPs('6', source))
  
          let response = await Promise.all(tasks)
          for(let element of response){
            for(let item of element){
              results.push(item)
            }
          }
  
          const getGeo = async (ip) => {
            try{
              let url = `https://ipinfo.io/${ip}/geo`
              let response = await axios.get(url)
              let geoinfo = response.data
              let city = geoinfo.city
              let region = geoinfo.region
              let nation = country.getName(geoinfo.country)
              let out = ''
              if(city === region){
                out = `${city}/${nation}`
              }else{
                out = `${city}/${region}/${nation}`
              }
              return out
            }catch(error){
              return ''
            }
          }
  
          const getAll = async (dnsEntry) => {
            let data = {}
            let geo = await getGeo(dnsEntry.address)
            data.address = dnsEntry.address
            data.ttl = dnsEntry.ttl
            data.geo = geo
            return data 
          }
  
          tasks = []
          for(let result of results){
            tasks.push(getAll(result))
          }
          let data = await Promise.all(tasks)
  
          console.log()
          console.log(`Server:  ${nameserver}`)
          console.log()
          console.log(`Name:    ${source}`)
          for(let [index, entry] of data.entries()){
            if(index === 0){
              console.log(`Addresses:  ${entry.address}    ttl=${entry.ttl}    ${entry.geo}`)
            }else{
              console.log(`            ${entry.address}    ttl=${entry.ttl}    ${entry.geo}`)
            }
          }
  
        }else{
          dns.setServers(nameserver)
          const getName = async (ip) => {
            try{
              return await dns.reverse(ip)
            }catch(error){
              return []
            }
          }
  
          let data = await getName(source)
  
          if(data.length > 0){
            console.log()
            for(let [index, server] of nameserver.entries()){
              if(index === 0){
                console.log(`Server:  ${server}`)
              }else{
                console.log(`         ${server}`)
              }
            }
            console.log()
            for(let [index,entry] of data.entries()){
              if(index === 0){
                console.log(`Name:    ${entry}`)        
              }else{
                console.log(`         ${entry}`)        
              }
            }
          }else{
           console.log('Has not find domain bind to this IP') 
          }
        }

      }else{
        let serverIP = await dns.getServers()
        for(let [index, value] of serverIP.entries()){
          if(index === 0 ){
            console.log(`You are using name server: ${value}`)
          }else{
            console.log(`                           ${value}`)
          }
        }
      }
    })
    await program.parseAsync(process.argv)

  }catch(error){
    console.dir(error)
  }
}

main()
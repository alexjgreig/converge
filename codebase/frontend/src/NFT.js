import React, { useEffect, useState } from 'react'
import { Form, Grid } from 'semantic-ui-react'

import { useSubstrateState } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

import NFTCards from './NFTCards'

const parseNFT = ({ price, owner }) => ({
  price: price.toJSON(),
  owner: owner.toJSON(),
})

export default function NFTs(props) {
  const { api, keyring } = useSubstrateState()
  const [nftIds, setNFTIds] = useState([])
  const [nfts, setNFTs] = useState([])
  const [status, setStatus] = useState('')


// Subscription function for nft count
const subscribeCount = () => {
  let unsub = null
  const asyncFetch = async () => {
    unsub = await api.query.substrateNFTs.countForNFTs(
      async count => {
        // Fetch all nft keys
        const entries = await api.query.substrateNFTs.nfts.entries()
        const ids = entries.map(entry => entry[1].unwrap().dna)
        setNFTIds(ids)
      }
    )
  }
  asyncFetch()
  return () => {
    unsub && unsub()
  }
}

// Subscription function to construct all nft objects
const subscribeNFTs = () => {
  let unsub = null
  const asyncFetch = async () => {
    unsub = await api.query.substrateNFTs.nfts.multi(
      nftIds,
      nfts => {
        const nftsMap = nfts.map(nft => parseNFT(nft.unwrap()))
        setNFTs(nftsMap)
      }
    )
  }
  asyncFetch()
  return () => {
    unsub && unsub()
  }
}
useEffect(subscribeCount, [api, keyring])
useEffect(subscribeNFTs, [api, keyring, nftIds])

return <Grid.Column width={16}>
  <h1>NFTs</h1>
  <NFTCards nfts={nfts} setStatus={setStatus}/>

<Form style={{ margin: '1em 0' }}>
      <Form.Field style={{ textAlign: 'center' }}>
        <TxButton
          label='Create NFT'
          type='SIGNED-TX'
          setStatus={setStatus}
          attrs={{
            palletRpc: 'substrateNFTs',
            callable: 'createNFT',
            inputParams: [],
            paramFields: []
          }}
        />
      </Form.Field>
    </Form>
    <div style={{ overflowWrap: 'break-word' }}>{status}</div>
  </Grid.Column>;
}
